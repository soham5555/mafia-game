import { buildState, getRoomByCode, getPlayerByToken } from "@/lib/state";
import { maybeAutoAdvance, checkAfk } from "@/lib/engine";
import { db } from "@/db";
import { players } from "@/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token");

  const room = await getRoomByCode(code);
  if (room) {
    // Heartbeat: record that this player is still present.
    if (token) {
      const me = await getPlayerByToken(room.id, token);
      if (me) {
        await db
          .update(players)
          .set({ lastSeenAt: new Date() })
          .where(eq(players.id, me.id));
      }
    }
    // Lazy timers: AFK punishment + auto phase advance.
    await checkAfk(room.id);
    await maybeAutoAdvance(room.id);
  }

  const state = await buildState(code, token);
  if (!state) return Response.json({ error: "Room not found" }, { status: 404 });
  return Response.json(state);
}
