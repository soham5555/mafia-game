import { db } from "@/db";
import { votes, players } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { getRoomByCode, getPlayerByToken } from "@/lib/state";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const body = await req.json().catch(() => ({}));
  const token = body?.token as string;
  const targetId = body?.targetId as number | null;

  const room = await getRoomByCode(code);
  if (!room) return Response.json({ error: "Room not found" }, { status: 404 });
  if (room.status !== "day")
    return Response.json({ error: "Not day phase" }, { status: 400 });
  const me = token ? await getPlayerByToken(room.id, token) : null;
  if (!me || !me.alive) return Response.json({ error: "Cannot vote" }, { status: 403 });
  const st = (me.state as Record<string, unknown>) ?? {};
  if (st.blockedVote)
    return Response.json({ error: "You were distracted and cannot vote" }, { status: 400 });

  if (targetId != null) {
    const t = await db
      .select()
      .from(players)
      .where(and(eq(players.roomId, room.id), eq(players.id, targetId)));
    if (!t[0] || !t[0].alive) return Response.json({ error: "Invalid target" }, { status: 400 });
  }

  await db
    .delete(votes)
    .where(
      and(
        eq(votes.roomId, room.id),
        eq(votes.dayNumber, room.dayNumber),
        eq(votes.voterId, me.id)
      )
    );
  await db.insert(votes).values({
    roomId: room.id,
    dayNumber: room.dayNumber,
    voterId: me.id,
    targetId: targetId ?? null,
  });

  return Response.json({ ok: true });
}
