import { db } from "@/db";
import { events } from "@/db/schema";
import { and, eq, gt } from "drizzle-orm";
import { getRoomByCode, getPlayerByToken } from "@/lib/state";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token");
  const since = Number(searchParams.get("since") ?? 0);

  const room = await getRoomByCode(code);
  if (!room) return Response.json({ error: "Room not found" }, { status: 404 });
  const me = token ? await getPlayerByToken(room.id, token) : null;

  const rows = await db
    .select()
    .from(events)
    .where(and(eq(events.roomId, room.id), gt(events.id, since)));

  const visible = rows
    .filter((e) => {
      if (e.audience === "all") return true;
      if (Array.isArray(e.audience) && me) return e.audience.includes(me.id);
      return false;
    })
    .map((e) => ({ id: e.id, type: e.type, meta: e.meta, createdAt: e.createdAt }));

  return Response.json({ events: visible, lastId: rows.length ? rows[rows.length - 1].id : since });
}
