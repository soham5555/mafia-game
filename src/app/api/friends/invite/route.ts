import { db } from "@/db";
import { users, friendships, players, rooms } from "@/db/schema";
import { eq, or, and, inArray } from "drizzle-orm";
import { getUserByToken } from "@/lib/auth";
import { notify } from "@/lib/notify";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const token = body?.token as string;
  const targetId = body?.targetId as number;

  const u = await getUserByToken(token);
  if (!u) return Response.json({ error: "Not authenticated" }, { status: 401 });

  // must be friends
  const rel = await db
    .select()
    .from(friendships)
    .where(
      or(
        and(eq(friendships.requesterId, u.id), eq(friendships.addresseeId, targetId)),
        and(eq(friendships.requesterId, targetId), eq(friendships.addresseeId, u.id))
      )
    );
  if (!rel[0] || rel[0].status !== "accepted")
    return Response.json({ error: "You can only invite friends" }, { status: 400 });

  // find the inviter's current joinable room (lobby)
  const myPlayers = await db
    .select()
    .from(players)
    .where(and(eq(players.userId, u.id), eq(players.leftGame, false)));
  if (myPlayers.length === 0)
    return Response.json({ error: "You're not in a game to invite to" }, { status: 400 });
  const roomIds = myPlayers.map((p) => p.roomId);
  const lobby = (
    await db
      .select()
      .from(rooms)
      .where(and(inArray(rooms.id, roomIds), eq(rooms.status, "lobby")))
  )[0];
  if (!lobby)
    return Response.json({ error: "You can only invite from a lobby" }, { status: 400 });

  await notify(
    targetId,
    "invite",
    `🎮 ${u.username} invited you to a game! Room code: ${lobby.code}`,
    { code: lobby.code }
  );

  return Response.json({ ok: true, code: lobby.code });
}
