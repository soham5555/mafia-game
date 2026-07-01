import { db } from "@/db";
import { players } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getRoomByCode, getPlayerByToken } from "@/lib/state";
import { assignRoles } from "@/lib/engine";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const body = await req.json().catch(() => ({}));
  const token = body?.token as string;
  let phaseSeconds = Number(body?.phaseSeconds);
  if (!Number.isFinite(phaseSeconds)) phaseSeconds = 0;
  // clamp: 0 = manual, otherwise 30..300
  if (phaseSeconds !== 0) phaseSeconds = Math.min(300, Math.max(30, Math.round(phaseSeconds)));

  const room = await getRoomByCode(code);
  if (!room) return Response.json({ error: "Room not found" }, { status: 404 });
  const me = token ? await getPlayerByToken(room.id, token) : null;
  if (!me?.isHost) return Response.json({ error: "Only the host can start" }, { status: 403 });
  if (room.status !== "lobby")
    return Response.json({ error: "Already started" }, { status: 400 });

  const roster = await db.select().from(players).where(eq(players.roomId, room.id));
  if (roster.length < 4)
    return Response.json({ error: "Need at least 4 players" }, { status: 400 });

  await assignRoles(room.id, phaseSeconds);
  return Response.json({ ok: true });
}
