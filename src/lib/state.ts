import { db } from "@/db";
import { rooms, players, messages, logs, actions, votes, users } from "@/db/schema";
import { and, eq, asc } from "drizzle-orm";
import { ROLES } from "./roles";
import { getMergedRoles } from "./roleResolver";

export async function getRoomByCode(code: string) {
  const r = await db.select().from(rooms).where(eq(rooms.code, code.toUpperCase()));
  return r[0] ?? null;
}

export async function getPlayerByToken(roomId: number, token: string) {
  const r = await db
    .select()
    .from(players)
    .where(and(eq(players.roomId, roomId), eq(players.token, token)));
  return r[0] ?? null;
}

export async function buildState(code: string, token: string | null) {
  const room = await getRoomByCode(code);
  if (!room) return null;
  const all = await db
    .select()
    .from(players)
    .where(eq(players.roomId, room.id))
    .orderBy(asc(players.seat));
  const me = token ? all.find((p) => p.token === token) ?? null : null;
  const RMAP = await getMergedRoles();

  const inGame = room.status !== "lobby";

  // avatar lookup for all seated players
  const userIds = all.map((p) => p.userId).filter((x): x is number => x != null);
  const usersInRoom = userIds.length ? await db.select().from(users) : [];
  const avatarOf = (userId: number | null) =>
    userId != null ? usersInRoom.find((x) => x.id === userId)?.avatar ?? "🕵️" : "🕵️";

  const publicPlayers = all.map((p) => {
    const showRole = room.status === "ended" || (!p.alive && inGame);
    const isMe = me && p.id === me.id;
    // mafia can see each other
    const mafiaVisible =
      me && me.team === "mafia" && p.team === "mafia" && inGame;
    return {
      id: p.id,
      name: p.name,
      seat: p.seat,
      isHost: p.isHost,
      alive: p.alive,
      avatar: avatarOf(p.userId),
      role: showRole || isMe || mafiaVisible ? p.role : null,
      roleName: showRole || isMe || mafiaVisible ? (p.role ? RMAP[p.role]?.name ?? p.role : null) : null,
      roleEmoji: showRole || isMe || mafiaVisible ? (p.role ? RMAP[p.role]?.emoji ?? "❓" : null) : null,
      team: showRole || mafiaVisible ? p.team : null,
    };
  });

  // messages: filter channels the player can see
  const allMsgs = await db
    .select()
    .from(messages)
    .where(eq(messages.roomId, room.id))
    .orderBy(asc(messages.createdAt));
  const canSeeMafiaChat = me && me.team === "mafia";
  const canSeeDeadChat = me && !me.alive;
  const visibleMsgs = allMsgs.filter((m) => {
    if (m.channel === "day" || m.channel === "system") return true;
    if (m.channel === "mafia") return canSeeMafiaChat;
    if (m.channel === "dead") return canSeeDeadChat;
    return false;
  });

  // logs for me
  let myLogs: { id: number; text: string; dayNumber: number }[] = [];
  if (me) {
    const allLogs = await db
      .select()
      .from(logs)
      .where(eq(logs.roomId, room.id))
      .orderBy(asc(logs.createdAt));
    myLogs = allLogs
      .filter((l) => l.audience === "all" || (Array.isArray(l.audience) && l.audience.includes(me.id)))
      .map((l) => ({ id: l.id, text: l.text, dayNumber: l.dayNumber }));
  }

  // my current action / vote
  let myAction: { targetId: number | null; actionType: string } | null = null;
  let myVote: number | null = null;
  if (me && inGame) {
    if (room.status === "night") {
      const a = await db
        .select()
        .from(actions)
        .where(
          and(
            eq(actions.roomId, room.id),
            eq(actions.dayNumber, room.dayNumber),
            eq(actions.actorId, me.id)
          )
        );
      if (a[0]) myAction = { targetId: a[0].targetId, actionType: a[0].actionType };
    } else if (room.status === "day") {
      const v = await db
        .select()
        .from(votes)
        .where(
          and(
            eq(votes.roomId, room.id),
            eq(votes.dayNumber, room.dayNumber),
            eq(votes.voterId, me.id)
          )
        );
      if (v[0]) myVote = v[0].targetId ?? null;
    }
  }

  // vote tally (visible during day)
  let voteTally: { targetId: number; count: number }[] = [];
  if (room.status === "day") {
    const dv = await db
      .select()
      .from(votes)
      .where(and(eq(votes.roomId, room.id), eq(votes.dayNumber, room.dayNumber)));
    const map = new Map<number, number>();
    const alive = new Set(all.filter((p) => p.alive).map((p) => p.id));
    for (const v of dv) {
      if (!v.targetId || !alive.has(v.voterId)) continue;
      const voter = all.find((p) => p.id === v.voterId);
      const weight = voter?.role === "mayor" ? 2 : 1;
      map.set(v.targetId, (map.get(v.targetId) ?? 0) + weight);
    }
    voteTally = [...map.entries()].map(([targetId, count]) => ({ targetId, count }));
  }

  // Inventory of the logged-in owner (for lobby item selection).
  let myInventory: Record<string, number> = {};
  if (me?.userId) {
    const u = (await db.select().from(users).where(eq(users.id, me.userId)))[0];
    if (u) myInventory = u.inventory ?? {};
  }
  const myEquip = ((me?.state as Record<string, unknown> | undefined)?.equip as Record<string, boolean>) ?? {};

  const meView = me
    ? {
        id: me.id,
        name: me.name,
        isHost: me.isHost,
        alive: me.alive,
        role: me.role,
        roleName: me.role ? RMAP[me.role]?.name ?? me.role : null,
        roleDef: me.role ? RMAP[me.role] ?? null : null,
        team: me.team,
        extraLives: me.extraLives,
        state: me.state,
        inventory: myInventory,
        equip: myEquip,
      }
    : null;

  return {
    room: {
      code: room.code,
      status: room.status,
      dayNumber: room.dayNumber,
      winner: room.winner,
      phaseSeconds: room.phaseSeconds,
      phaseEndsAt: room.phaseEndsAt ? room.phaseEndsAt.toISOString() : null,
      isPublic: room.isPublic,
      hostName: room.hostName,
    },
    me: meView,
    players: publicPlayers,
    messages: visibleMsgs.map((m) => ({
      id: m.id,
      channel: m.channel,
      senderName: m.senderName,
      text: m.text,
      createdAt: m.createdAt,
    })),
    logs: myLogs,
    myAction,
    myVote,
    voteTally,
  };
}

export type GameState = NonNullable<Awaited<ReturnType<typeof buildState>>>;
