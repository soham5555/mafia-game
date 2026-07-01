import { db } from "@/db";
import { players, actions, votes, logs, messages, rooms } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getRoomByCode, getPlayerByToken } from "@/lib/state";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const body = await req.json().catch(() => ({}));
  const token = body?.token as string;
  const room = await getRoomByCode(code);
  if (!room) return Response.json({ error: "Room not found" }, { status: 404 });
  const me = token ? await getPlayerByToken(room.id, token) : null;
  if (!me?.isHost) return Response.json({ error: "Only the host can reset" }, { status: 403 });

  await db.delete(actions).where(eq(actions.roomId, room.id));
  await db.delete(votes).where(eq(votes.roomId, room.id));
  await db.delete(logs).where(eq(logs.roomId, room.id));
  await db.delete(messages).where(eq(messages.roomId, room.id));
  await db
    .update(players)
    .set({ role: null, team: null, alive: true, extraLives: 0, state: {} })
    .where(eq(players.roomId, room.id));
  await db
    .update(rooms)
    .set({
      status: "lobby",
      dayNumber: 0,
      winner: null,
      phaseSeconds: 0,
      phaseEndsAt: null,
      updatedAt: new Date(),
    })
    .where(eq(rooms.id, room.id));

  return Response.json({ ok: true });
}
