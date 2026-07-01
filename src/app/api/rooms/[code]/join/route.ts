import { db } from "@/db";
import { players } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getRoomByCode } from "@/lib/state";
import { genToken } from "@/lib/engine";
import { getUserByToken } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const body = await req.json().catch(() => ({}));
  const authToken = body?.authToken as string;
  const user = await getUserByToken(authToken);
  if (!user) return Response.json({ error: "Please sign in first" }, { status: 401 });
  if (user.banned) return Response.json({ error: "You are banned and cannot play" }, { status: 403 });
  if (!user.approved)
    return Response.json({ error: "Your account is awaiting admin approval" }, { status: 403 });

  const room = await getRoomByCode(code);
  if (!room) return Response.json({ error: "Room not found" }, { status: 404 });
  if (room.status !== "lobby")
    return Response.json({ error: "Game already started" }, { status: 400 });

  const existing = await db.select().from(players).where(eq(players.roomId, room.id));
  // already joined with this account? return existing token
  const mine = existing.find((p) => p.userId === user.id);
  if (mine) return Response.json({ code: room.code, token: mine.token });

  if (existing.length >= 24) return Response.json({ error: "Room is full" }, { status: 400 });

  const token = genToken();
  const seat = existing.length + 1;
  await db.insert(players).values({
    roomId: room.id,
    userId: user.id,
    token,
    name: user.username,
    seat,
    isHost: false,
  });

  return Response.json({ code: room.code, token });
}
