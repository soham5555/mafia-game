import { db } from "@/db";
import { rooms, players } from "@/db/schema";
import { and, eq, inArray, ne } from "drizzle-orm";
import { genCode, genToken } from "@/lib/engine";
import { getUserByToken } from "@/lib/auth";

export const dynamic = "force-dynamic";

async function hasActiveGame(userId: number) {
  const myPlayers = await db
    .select()
    .from(players)
    .where(and(eq(players.userId, userId), eq(players.leftGame, false)));
  if (myPlayers.length === 0) return false;
  const roomIds = myPlayers.map((p) => p.roomId);
  const activeRooms = await db
    .select()
    .from(rooms)
    .where(and(inArray(rooms.id, roomIds), ne(rooms.status, "ended")));
  return activeRooms.length > 0;
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const authToken = body?.authToken as string;
  const user = await getUserByToken(authToken);
  if (!user) return Response.json({ error: "Please sign in first" }, { status: 401 });
  if (user.banned) return Response.json({ error: "You are banned and cannot play" }, { status: 403 });
  if (!user.approved)
    return Response.json({ error: "Your account is awaiting admin approval" }, { status: 403 });
  if (await hasActiveGame(user.id))
    return Response.json({ error: "You're already in a game. Resume or leave it first." }, { status: 400 });

  // generate unique code
  let code = genCode();
  for (let i = 0; i < 10; i++) {
    const existing = await db.select().from(rooms).where(eq(rooms.code, code));
    if (existing.length === 0) break;
    code = genCode();
  }

  const isPublic = Boolean(body?.isPublic);
  const inserted = await db
    .insert(rooms)
    .values({ code, isPublic, hostName: user.username })
    .returning();
  const room = inserted[0];
  const token = genToken();
  await db.insert(players).values({
    roomId: room.id,
    userId: user.id,
    token,
    name: user.username,
    seat: 1,
    isHost: true,
  });

  return Response.json({ code: room.code, token });
}
