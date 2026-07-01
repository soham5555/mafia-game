import { db } from "@/db";
import { players, actions, votes, logs, rooms, messages, users, events, matchHistory } from "@/db/schema";
import { and, eq, lt } from "drizzle-orm";
import { ROLES, ROLE_PRIORITY, type Team } from "./roles";
import { REWARD_WIN, REWARD_PARTICIPATE } from "./shop";
import { notify } from "./notify";
import { getMergedRoles, getActiveCustomRoles } from "./roleResolver";

export function genCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 5; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

export function genToken(): string {
  return (
    Math.random().toString(36).slice(2) +
    Math.random().toString(36).slice(2) +
    Date.now().toString(36)
  );
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Build a balanced role list appropriate for the number of players. */
export function buildRoleSet(
  count: number,
  customByTeam: { town: string[]; mafia: string[]; neutral: string[] } = {
    town: [],
    mafia: [],
    neutral: [],
  }
): string[] {
  // Team sizing: ~1 mafia per 4-5 players, some neutrals in bigger games.
  const mafiaCount = Math.max(1, Math.round(count / 4.5));
  let neutralCount = 0;
  if (count >= 7) neutralCount = 1;
  if (count >= 11) neutralCount = 2;
  const townCount = Math.max(1, count - mafiaCount - neutralCount);

  const mafiaRoster = ["don", ...customByTeam.mafia, "mafia", "lawyer", "assassin", "journalist"];
  const townRoster = [
    "commissioner",
    "doctor",
    ...customByTeam.town,
    "mayor",
    "mistress",
    "hobo",
    "sergeant",
    "lucky",
    "kamikaze",
  ];
  const neutralRoster = [
    ...customByTeam.neutral,
    "maniac",
    "arsonist",
    "werewolf",
    "mage",
    "conartist",
    "snitch",
    "suicidal",
  ];

  const pool: string[] = [];

  // Mafia
  for (let i = 0; i < mafiaCount; i++) {
    pool.push(mafiaRoster[i] ?? "mafia");
  }
  // Neutrals (shuffled selection)
  const nShuf = shuffle(neutralRoster);
  for (let i = 0; i < neutralCount; i++) {
    pool.push(nShuf[i] ?? "maniac");
  }
  // Town: fill priority roles then civilians
  const townShufExtras = shuffle(townRoster.slice(2)); // keep commissioner+doctor guaranteed
  const townPicks = ["commissioner", "doctor", ...townShufExtras];
  for (let i = 0; i < townCount; i++) {
    pool.push(townPicks[i] ?? "civilian");
  }

  return shuffle(pool.slice(0, count));
}

export const ITEM_FLAGS: Record<string, string> = {
  fake_id: "fakeId",
  vest: "vest",
  alibi: "alibi",
  double_vote: "doubleVote",
};

/**
 * Equip only the items the player toggled ON in the lobby (default is OFF).
 * Selected items are consumed from the user's inventory.
 */
async function equipItems(
  userId: number | null,
  selection: Record<string, boolean>
): Promise<Record<string, unknown>> {
  const state: Record<string, unknown> = {};
  if (!userId) return state;
  const u = (await db.select().from(users).where(eq(users.id, userId)))[0];
  if (!u) return state;
  const inv = { ...(u.inventory ?? {}) };
  let changed = false;
  for (const [key, flag] of Object.entries(ITEM_FLAGS)) {
    if (selection[key] && (inv[key] ?? 0) > 0) {
      state[flag] = true;
      inv[key] = inv[key] - 1;
      changed = true;
    }
  }
  if (changed) await db.update(users).set({ inventory: inv }).where(eq(users.id, userId));
  return state;
}

export async function assignRoles(roomId: number, phaseSeconds = 0) {
  const roomPlayers = await db.select().from(players).where(eq(players.roomId, roomId));
  const merged = await getMergedRoles();
  const customRows = await getActiveCustomRoles();
  const customByTeam = {
    town: customRows.filter((r) => r.team === "town").map((r) => r.roleKey),
    mafia: customRows.filter((r) => r.team === "mafia").map((r) => r.roleKey),
    neutral: customRows.filter((r) => r.team === "neutral").map((r) => r.roleKey),
  };
  const roleSet = buildRoleSet(roomPlayers.length, customByTeam);
  const shuffledPlayers = shuffle(roomPlayers);
  for (let i = 0; i < shuffledPlayers.length; i++) {
    const p = shuffledPlayers[i];
    const roleKey = roleSet[i];
    const def = merged[roleKey] ?? ROLES.civilian;
    const extraLives = roleKey === "lucky" ? 1 : 0;
    const selection = ((p.state as Record<string, unknown>)?.equip as Record<string, boolean>) ?? {};
    const itemState = await equipItems(p.userId, selection);
    await db
      .update(players)
      .set({
        role: roleKey,
        team: def.team,
        alive: true,
        extraLives,
        state: itemState,
      })
      .where(eq(players.id, p.id));
  }
  const phaseEndsAt =
    phaseSeconds > 0 ? new Date(Date.now() + phaseSeconds * 1000) : null;
  await db
    .update(rooms)
    .set({
      status: "night",
      dayNumber: 1,
      winner: null,
      phaseSeconds,
      phaseEndsAt,
      updatedAt: new Date(),
    })
    .where(eq(rooms.id, roomId));
  await addLog(roomId, 1, "🌙 Night 1 falls over the city. Everyone use your abilities.", "all");
}

export async function addLog(
  roomId: number,
  dayNumber: number,
  text: string,
  audience: number[] | "all"
) {
  await db.insert(logs).values({ roomId, dayNumber, text, audience });
}

export async function sysMessage(roomId: number, text: string, channel = "system") {
  await db.insert(messages).values({ roomId, channel, senderName: "Narrator", text });
}

export async function emitEvent(
  roomId: number,
  type: string,
  audience: number[] | "all",
  meta: Record<string, unknown> = {}
) {
  await db.insert(events).values({ roomId, type, audience, meta });
}

const AFK_MS = 30_000;

/** Mark players who abandoned an active game (no heartbeat for 30s). */
export async function checkAfk(roomId: number) {
  const room = (await db.select().from(rooms).where(eq(rooms.id, roomId)))[0];
  if (!room || (room.status !== "night" && room.status !== "day")) return;
  const cutoff = new Date(Date.now() - AFK_MS);
  const afk = await db
    .select()
    .from(players)
    .where(and(eq(players.roomId, roomId), eq(players.alive, true), lt(players.lastSeenAt, cutoff)));
  for (const p of afk) {
    await db
      .update(players)
      .set({ alive: false, leftGame: true, state: { ...(p.state ?? {}), diedAt: "left", diedDay: room.dayNumber } })
      .where(eq(players.id, p.id));
    await sysMessage(roomId, `🚪 ${p.name} abandoned the city and was found dead in a ditch (left the game).`);
    // penalty: lose coins
    if (p.userId) {
      const u = (await db.select().from(users).where(eq(users.id, p.userId)))[0];
      if (u) {
        const penalty = Math.min(100, u.coins);
        await db.update(users).set({ coins: u.coins - penalty }).where(eq(users.id, u.id));
        await notify(u.id, "coins", `−${penalty} 🪙 penalty for leaving a game.`);
      }
    }
  }
  if (afk.length > 0) await checkWin(roomId);
}

type PlayerRow = typeof players.$inferSelect;
type ActionRow = typeof actions.$inferSelect;

function alivePlayers(list: PlayerRow[]) {
  return list.filter((p) => p.alive);
}

function findRole(list: PlayerRow[], role: string) {
  return list.find((p) => p.alive && p.role === role);
}

function actionOf(acts: ActionRow[], actorId: number) {
  return acts.find((a) => a.actorId === actorId);
}

/** Resolve the current night and transition to day. */
export async function resolveNight(roomId: number) {
  const room = (await db.select().from(rooms).where(eq(rooms.id, roomId)))[0];
  if (!room) return;
  const day = room.dayNumber;
  const ROLESX = await getMergedRoles();
  const all = await db.select().from(players).where(eq(players.roomId, roomId));
  const acts = await db
    .select()
    .from(actions)
    .where(and(eq(actions.roomId, roomId), eq(actions.dayNumber, day)));

  const byId = new Map(all.map((p) => [p.id, p]));
  const name = (id: number | null | undefined) =>
    id != null ? byId.get(id)?.name ?? "someone" : "someone";

  // ---- Blocking (Mistress) ----
  const blocked = new Set<number>();
  const mistress = findRole(all, "mistress");
  if (mistress) {
    const a = actionOf(acts, mistress.id);
    if (a?.targetId) {
      blocked.add(a.targetId);
      // mark blocked player cannot vote next day
      const t = byId.get(a.targetId);
      if (t) {
        await db
          .update(players)
          .set({ state: { ...(t.state ?? {}), blockedVote: true } })
          .where(eq(players.id, t.id));
      }
    }
  }

  const isBlocked = (id: number) => blocked.has(id);

  // ---- Lawyer protection ----
  let lawyerTarget: number | null = null;
  const lawyer = findRole(all, "lawyer");
  if (lawyer && !isBlocked(lawyer.id)) {
    const a = actionOf(acts, lawyer.id);
    if (a?.targetId) {
      lawyerTarget = a.targetId;
      const t = byId.get(a.targetId);
      if (t) {
        await db
          .update(players)
          .set({ state: { ...(t.state ?? {}), lynchImmune: true } })
          .where(eq(players.id, t.id));
      }
    }
  }

  // ---- Doctor heal ----
  const healed = new Set<number>();
  const doctor = findRole(all, "doctor");
  if (doctor && !isBlocked(doctor.id)) {
    const a = actionOf(acts, doctor.id);
    if (a?.targetId) healed.add(a.targetId);
  }

  // Attacks: { targetId, attackerId, kind, unstoppable }
  interface Attack {
    targetId: number;
    attackerId: number;
    kind: "mafia" | "assassin" | "maniac" | "arson";
    unstoppable: boolean;
  }
  const attacks: Attack[] = [];

  // ---- Mafia collective kill (Don priority else mafia votes) ----
  const don = findRole(all, "don");
  const mafiaMembers = alivePlayers(all).filter(
    (p) => p.team === "mafia" && p.role !== "assassin"
  );
  let mafiaTarget: number | null = null;
  let mafiaAttacker: number | null = null;
  if (don && !isBlocked(don.id)) {
    const a = actionOf(acts, don.id);
    if (a?.targetId) {
      mafiaTarget = a.targetId;
      mafiaAttacker = don.id;
    }
  }
  if (mafiaTarget == null) {
    // tally mafia votes
    const tally = new Map<number, number>();
    for (const m of mafiaMembers) {
      if (isBlocked(m.id)) continue;
      const a = actionOf(acts, m.id);
      if (a?.targetId) tally.set(a.targetId, (tally.get(a.targetId) ?? 0) + 1);
    }
    let best = -1;
    for (const [t, c] of tally) {
      if (c > best) {
        best = c;
        mafiaTarget = t;
      }
    }
    mafiaAttacker = mafiaMembers[0]?.id ?? null;
  }
  if (mafiaTarget != null && mafiaAttacker != null) {
    attacks.push({
      targetId: mafiaTarget,
      attackerId: mafiaAttacker,
      kind: "mafia",
      unstoppable: false,
    });
  }

  // ---- Assassin unstoppable ----
  const assassin = findRole(all, "assassin");
  if (assassin) {
    const a = actionOf(acts, assassin.id);
    if (a?.targetId) {
      const target = byId.get(a.targetId);
      if (target?.role === "commissioner") {
        // targeting commissioner removes assassin
        attacks.push({
          targetId: assassin.id,
          attackerId: assassin.id,
          kind: "assassin",
          unstoppable: true,
        });
        await addLog(roomId, day, "The Assassin foolishly targeted the Commissioner and was caught.", "all");
      } else {
        attacks.push({
          targetId: a.targetId,
          attackerId: assassin.id,
          kind: "assassin",
          unstoppable: true,
        });
      }
    }
  }

  // ---- Maniac ----
  const maniac = findRole(all, "maniac");
  if (maniac && !isBlocked(maniac.id)) {
    const a = actionOf(acts, maniac.id);
    if (a?.targetId) {
      attacks.push({
        targetId: a.targetId,
        attackerId: maniac.id,
        kind: "maniac",
        unstoppable: false,
      });
    }
  }

  // ---- Arsonist ----
  const arsonist = findRole(all, "arsonist");
  if (arsonist && !isBlocked(arsonist.id)) {
    const a = actionOf(acts, arsonist.id);
    const doused: number[] = ((arsonist.state as Record<string, unknown>)?.doused as number[]) ?? [];
    if (a?.actionType === "ignite") {
      for (const t of doused) {
        attacks.push({ targetId: t, attackerId: arsonist.id, kind: "arson", unstoppable: true });
      }
      await db
        .update(players)
        .set({ state: { ...(arsonist.state ?? {}), doused: [] } })
        .where(eq(players.id, arsonist.id));
    } else if (a?.targetId) {
      if (!doused.includes(a.targetId)) doused.push(a.targetId);
      await db
        .update(players)
        .set({ state: { ...(arsonist.state ?? {}), doused } })
        .where(eq(players.id, arsonist.id));
    }
  }

  // ---- Resolve deaths ----
  const deaths = new Set<number>();
  const counterKills: { targetId: number; reason: string }[] = [];
  const witnessedBy = new Map<number, number[]>(); // victimId -> witness ids

  // Hobo witnessing: map house -> hobo
  const hobo = findRole(all, "hobo");
  let hoboHouse: number | null = null;
  if (hobo && !isBlocked(hobo.id)) {
    const a = actionOf(acts, hobo.id);
    if (a?.targetId) hoboHouse = a.targetId;
  }

  for (const atk of attacks) {
    const target = byId.get(atk.targetId);
    if (!target || !target.alive) continue;
    if (deaths.has(target.id)) continue;

    // Mage counter: if attacked by don(mafia)/maniac/commissioner-kill, fails
    if (target.role === "mage" && (atk.kind === "mafia" || atk.kind === "maniac")) {
      counterKills.push({ targetId: atk.attackerId, reason: "the Mage's wrath" });
      await addLog(roomId, day, "A dark force protected the Mage and struck back at an attacker.", "all");
      continue;
    }

    // Doctor save (not for unstoppable)
    if (!atk.unstoppable && healed.has(target.id)) {
      await addLog(roomId, day, `The Doctor saved ${name(target.id)} from death.`, "all");
      continue;
    }

    // Bulletproof vest item (not for unstoppable)
    const tState = (target.state as Record<string, unknown>) ?? {};
    if (!atk.unstoppable && tState.vest) {
      await db
        .update(players)
        .set({ state: { ...tState, vest: false } })
        .where(eq(players.id, target.id));
      await addLog(roomId, day, `🦺 Your Bulletproof Vest absorbed an attack!`, [target.id]);
      continue;
    }

    // Kamikaze counter: takes attacker with them
    if (target.role === "kamikaze") {
      counterKills.push({ targetId: atk.attackerId, reason: "the Kamikaze's blast" });
    }

    // Werewolf special transformations
    if (target.role === "werewolf" && atk.kind !== "maniac") {
      if (atk.kind === "mafia") {
        await db
          .update(players)
          .set({ role: "mafia", team: "mafia" })
          .where(eq(players.id, target.id));
        await addLog(roomId, day, `${name(target.id)} was attacked and transformed into a Werewolf ally of the Mafia.`, [target.id]);
        continue;
      }
    }

    // Lucky extra life
    if ((target.extraLives ?? 0) > 0) {
      await db
        .update(players)
        .set({ extraLives: (target.extraLives ?? 0) - 1 })
        .where(eq(players.id, target.id));
      await addLog(roomId, day, `${name(target.id)} narrowly survived an attack.`, [target.id]);
      continue;
    }

    deaths.add(target.id);
    // hobo witness
    if (hoboHouse != null && hoboHouse === target.id) {
      const arr = witnessedBy.get(target.id) ?? [];
      if (hobo) arr.push(hobo.id);
      witnessedBy.set(target.id, arr);
    }
  }

  // counter kills
  for (const ck of counterKills) {
    const t = byId.get(ck.targetId);
    if (t && t.alive && !deaths.has(t.id)) {
      if ((t.extraLives ?? 0) > 0) {
        await db.update(players).set({ extraLives: (t.extraLives ?? 0) - 1 }).where(eq(players.id, t.id));
      } else {
        deaths.add(t.id);
      }
    }
  }

  // Apply deaths
  for (const id of deaths) {
    await db.update(players).set({ alive: false }).where(eq(players.id, id));
    const p = byId.get(id);
    if (p) {
      const st = (p.state as Record<string, unknown>) ?? {};
      st.diedAt = "night";
      st.diedDay = day;
      await db.update(players).set({ state: st }).where(eq(players.id, id));
    }
    // suicidal dying at night = loss noted (no special)
  }

  // ---- Commissioner investigation ----
  const commissioner = findRole(all, "commissioner");
  let commTarget: number | null = null;
  if (commissioner && !isBlocked(commissioner.id)) {
    const a = actionOf(acts, commissioner.id);
    if (a?.targetId) {
      commTarget = a.targetId;
      const target = byId.get(a.targetId);
      if (target) {
        let isMafia = target.team === "mafia";
        if (lawyerTarget === target.id) isMafia = false; // lawyer masks
        const tState = (target.state as Record<string, unknown>) ?? {};
        if (tState.fakeId) {
          isMafia = false; // forged dossier hides identity
          await db
            .update(players)
            .set({ state: { ...tState, fakeId: false } })
            .where(eq(players.id, target.id));
        }
        await addLog(
          roomId,
          day,
          `🔎 Your investigation reveals ${name(target.id)} is ${isMafia ? "a member of the MAFIA" : "NOT Mafia"}.`,
          [commissioner.id]
        );
        await emitEvent(
          roomId,
          isMafia ? "found_mafia" : "found_innocent",
          [commissioner.id],
          { targetName: name(target.id) }
        );
      }
    }
  }

  // ---- Snitch ----
  const snitch = findRole(all, "snitch");
  if (snitch && !isBlocked(snitch.id)) {
    const a = actionOf(acts, snitch.id);
    if (a?.targetId && commTarget != null && a.targetId === commTarget) {
      const t = byId.get(a.targetId);
      const tState = (t?.state as Record<string, unknown>) ?? {};
      if (t?.role && tState.fakeId) {
        await sysMessage(roomId, `🐍 The Snitch checked ${name(t.id)} — they appear to be a Civilian.`);
      } else if (t?.role) {
        await sysMessage(
          roomId,
          `🐍 The Snitch exposed ${name(t.id)} — their role is ${ROLESX[t.role]?.name ?? t.role}!`
        );
      }
    }
  }

  // ---- Journalist ----
  const journalist = findRole(all, "journalist");
  if (journalist && !isBlocked(journalist.id)) {
    const a = actionOf(acts, journalist.id);
    if (a?.targetId) {
      const t = byId.get(a.targetId);
      const tState = (t?.state as Record<string, unknown>) ?? {};
      if (t?.role && tState.fakeId) {
        await addLog(roomId, day, `📰 Your sources say ${name(t.id)} is just a Civilian.`, [journalist.id]);
      } else if (t?.role && t.role !== "commissioner") {
        await addLog(
          roomId,
          day,
          `📰 Your sources reveal ${name(t.id)} is the ${ROLESX[t.role]?.name ?? t.role}.`,
          [journalist.id]
        );
      } else {
        await addLog(roomId, day, `📰 You could not identify that player.`, [journalist.id]);
      }
    }
  }

  // ---- Con Artist disguise ----
  const conartist = findRole(all, "conartist");
  if (conartist && !isBlocked(conartist.id)) {
    const a = actionOf(acts, conartist.id);
    if (a?.targetId) {
      const t = byId.get(a.targetId);
      if (t) {
        await addLog(roomId, day, `🃏 You visited ${name(t.id)} and adopted a disguise.`, [conartist.id]);
      }
    }
  }

  // Hobo witness logs
  for (const [victim, witnesses] of witnessedBy) {
    for (const w of witnesses) {
      await addLog(roomId, day, `🍷 While drinking, you witnessed the murder of ${name(victim)}!`, [w]);
    }
  }

  // Death announcements
  if (deaths.size === 0) {
    await sysMessage(roomId, `☀️ Day ${day}: The night was quiet. No one died.`);
  } else {
    for (const id of deaths) {
      const p = byId.get(id);
      if (p?.role) {
        await sysMessage(roomId, `☀️ ${name(id)} was found dead. They were the ${ROLESX[p.role]?.name ?? p.role}.`);
      }
    }
  }

  // Sergeant inherits commissioner if commissioner died
  if (commissioner && deaths.has(commissioner.id)) {
    const sergeant = findRole(all, "sergeant");
    if (sergeant && !deaths.has(sergeant.id)) {
      await db
        .update(players)
        .set({ role: "commissioner", team: "town" })
        .where(eq(players.id, sergeant.id));
      await addLog(roomId, day, "You have inherited the role of Commissioner Cattani.", [sergeant.id]);
    }
  }

  const dayEnds =
    room.phaseSeconds > 0 ? new Date(Date.now() + room.phaseSeconds * 1000) : null;
  await db
    .update(rooms)
    .set({ status: "day", phaseEndsAt: dayEnds, updatedAt: new Date() })
    .where(eq(rooms.id, roomId));
  await checkWin(roomId);
}

/** Resolve day voting and transition to next night. */
export async function resolveDay(roomId: number) {
  const room = (await db.select().from(rooms).where(eq(rooms.id, roomId)))[0];
  if (!room) return;
  const day = room.dayNumber;
  const ROLESX = await getMergedRoles();
  const all = await db.select().from(players).where(eq(players.roomId, roomId));
  const byId = new Map(all.map((p) => [p.id, p]));
  const name = (id: number) => byId.get(id)?.name ?? "someone";
  const dayVotes = await db
    .select()
    .from(votes)
    .where(and(eq(votes.roomId, roomId), eq(votes.dayNumber, day)));

  const tally = new Map<number, number>();
  for (const v of dayVotes) {
    if (!v.targetId) continue;
    const voter = byId.get(v.voterId);
    if (!voter || !voter.alive) continue;
    const st = (voter.state as Record<string, unknown>) ?? {};
    if (st.blockedVote) continue; // mistress-blocked can't vote
    let weight = voter.role === "mayor" ? 2 : 1;
    if (st.doubleVote) weight *= 2; // ballot stuffer item
    tally.set(v.targetId, (tally.get(v.targetId) ?? 0) + weight);
  }

  let target: number | null = null;
  let best = 0;
  let tie = false;
  for (const [t, c] of tally) {
    if (c > best) {
      best = c;
      target = t;
      tie = false;
    } else if (c === best) {
      tie = true;
    }
  }

  if (target != null && best > 0 && !tie) {
    const p = byId.get(target);
    const st = (p?.state as Record<string, unknown>) ?? {};
    // Lawyer lynch immunity or personal Alibi item
    if (st.lynchImmune) {
      await sysMessage(roomId, `⚖️ The town voted to lynch ${name(target)}, but a Lawyer's protection saved them.`);
    } else if (st.alibi) {
      await db
        .update(players)
        .set({ state: { ...st, alibi: false } })
        .where(eq(players.id, target));
      await sysMessage(roomId, `📜 The town voted to lynch ${name(target)}, but they produced an Ironclad Alibi and walked free.`);
    } else {
      await db.update(players).set({ alive: false }).where(eq(players.id, target));
      st.diedAt = "day";
      st.diedDay = day;
      await db.update(players).set({ state: st }).where(eq(players.id, target));
      if (p?.role) {
        await sysMessage(roomId, `🪢 ${name(target)} was lynched by the town. They were the ${ROLESX[p.role]?.name ?? p.role}.`);
        if (p.role === "suicidal") {
          await sysMessage(roomId, `🪦 ${name(target)} the Suicidal got their wish and WINS!`);
        }
        if (p.role === "kamikaze") {
          await sysMessage(roomId, `💣 The Kamikaze detonates! They may take a target down with them (host decides on next resolve).`);
        }
      }
    }
  } else {
    await sysMessage(roomId, `🤝 Day ${day}: No one was lynched.`);
  }

  // clear per-day flags (blockedVote, lynchImmune, consumed doubleVote)
  for (const p of all) {
    const st = { ...((p.state as Record<string, unknown>) ?? {}) };
    delete st.blockedVote;
    delete st.lynchImmune;
    if (st.doubleVote) delete st.doubleVote; // ballot stuffer is one day only
    await db.update(players).set({ state: st }).where(eq(players.id, p.id));
  }

  const nextDay = day + 1;
  const nightEnds =
    room.phaseSeconds > 0 ? new Date(Date.now() + room.phaseSeconds * 1000) : null;
  await db
    .update(rooms)
    .set({ status: "night", dayNumber: nextDay, phaseEndsAt: nightEnds, updatedAt: new Date() })
    .where(eq(rooms.id, roomId));
  await addLog(roomId, nextDay, `🌙 Night ${nextDay} begins.`, "all");
  await checkWin(roomId);
}

/**
 * If the room is on a timer and the phase deadline has passed, atomically claim
 * the resolution and advance. Safe against concurrent pollers.
 */
export async function maybeAutoAdvance(roomId: number) {
  const room = (await db.select().from(rooms).where(eq(rooms.id, roomId)))[0];
  if (!room) return;
  if (room.status !== "night" && room.status !== "day") return;
  if (!room.phaseEndsAt) return;
  if (room.phaseEndsAt.getTime() > Date.now()) return;

  // Atomic claim: clear phaseEndsAt only if it still matches. Only one wins.
  const claimed = await db
    .update(rooms)
    .set({ phaseEndsAt: null })
    .where(and(eq(rooms.id, roomId), eq(rooms.phaseEndsAt, room.phaseEndsAt)))
    .returning();
  if (claimed.length === 0) return; // someone else claimed it

  if (room.status === "night") await resolveNight(roomId);
  else if (room.status === "day") await resolveDay(roomId);
}

export async function checkWin(roomId: number) {
  const roomRow = (await db.select().from(rooms).where(eq(rooms.id, roomId)))[0];
  const all = await db.select().from(players).where(eq(players.roomId, roomId));
  const alive = all.filter((p) => p.alive);
  const mafia = alive.filter((p) => p.team === "mafia");
  const town = alive.filter((p) => p.team === "town");
  const maniac = alive.find((p) => p.role === "maniac");

  const others = alive.length - mafia.length; // non-mafia alive

  let winner: string | null = null;
  if (alive.length === 0) {
    winner = "draw";
  } else if (maniac && alive.length === 1) {
    winner = "maniac";
  } else if (mafia.length === 0 && !maniac) {
    winner = "town";
  } else if (mafia.length > 0 && !maniac && mafia.length >= others) {
    // mafia reach parity with everyone else
    winner = "mafia";
  }
  void town;

  if (winner) {
    await db
      .update(rooms)
      .set({ status: "ended", winner, phaseEndsAt: null, updatedAt: new Date() })
      .where(eq(rooms.id, roomId));

    // ---- Reward coins ----
    const winnerIds = new Set<number>();
    if (winner === "town") all.filter((p) => p.team === "town").forEach((p) => winnerIds.add(p.id));
    else if (winner === "mafia")
      all.filter((p) => p.team === "mafia").forEach((p) => winnerIds.add(p.id));
    else if (winner === "maniac")
      all.filter((p) => p.role === "maniac").forEach((p) => winnerIds.add(p.id));

    for (const p of all) {
      if (!p.userId) continue;
      const won = winnerIds.has(p.id);
      const reward = REWARD_PARTICIPATE + (won ? REWARD_WIN : 0);
      const u = (await db.select().from(users).where(eq(users.id, p.userId)))[0];
      if (u) {
        await db.update(users).set({ coins: u.coins + reward }).where(eq(users.id, u.id));
        // Match history record
        await db.insert(matchHistory).values({
          userId: u.id,
          roomCode: roomRow?.code ?? "",
          role: p.role,
          team: p.team,
          result: won ? "win" : "lose",
        });
        // Excited win / consolation lose notification
        if (won) {
          await notify(
            u.id,
            "win",
            `🎉🏆 VICTORY! Congratulations, you WON the game and earned ${reward} 🪙!`
          );
        } else {
          await notify(
            u.id,
            "lose",
            `😔 Better luck next time! You lost this game but earned ${reward} 🪙 for playing.`
          );
        }
        await addLog(
          roomId,
          0,
          won
            ? `💸 Victory! You earned ${reward} coins 🪙 (${REWARD_WIN} win bonus + ${REWARD_PARTICIPATE}).`
            : `🪙 You earned ${REWARD_PARTICIPATE} coins for playing.`,
          [p.id]
        );
      }
    }

    const label =
      winner === "town"
        ? "🏆 The Town wins! All threats eliminated."
        : winner === "mafia"
        ? "🏆 The Mafia wins! They control the city."
        : winner === "maniac"
        ? "🏆 The Maniac wins! Last one standing."
        : "The game ends in a draw.";
    await sysMessage(roomId, label);
  }
}

export type { Team };
