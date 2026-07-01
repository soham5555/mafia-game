import { db } from "@/db";
import { players, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getRoomByCode, getPlayerByToken } from "@/lib/state";
import { ITEM_FLAGS } from "@/lib/engine";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const body = await req.json().catch(() => ({}));
  const token = body?.token as string;
  const itemKey = body?.itemKey as string;
  const on = Boolean(body?.on);

  const room = await getRoomByCode(code);
  if (!room) return Response.json({ error: "Room not found" }, { status: 404 });
  if (room.status !== "lobby")
    return Response.json({ error: "Can only change items in the lobby" }, { status: 400 });
  const me = token ? await getPlayerByToken(room.id, token) : null;
  if (!me) return Response.json({ error: "Not in room" }, { status: 403 });
  if (!ITEM_FLAGS[itemKey]) return Response.json({ error: "Unknown item" }, { status: 400 });

  // must own the item to enable it
  if (on && me.userId) {
    const u = (await db.select().from(users).where(eq(users.id, me.userId)))[0];
    if (!u || (u.inventory?.[itemKey] ?? 0) < 1)
      return Response.json({ error: "You don't own that item" }, { status: 400 });
  }

  const state = { ...((me.state as Record<string, unknown>) ?? {}) };
  const equip = { ...((state.equip as Record<string, boolean>) ?? {}) };
  equip[itemKey] = on;
  state.equip = equip;
  await db.update(players).set({ state }).where(eq(players.id, me.id));

  return Response.json({ ok: true, equip });
}
