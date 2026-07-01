import { db } from "@/db";
import { rooms } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getRoomByCode, getPlayerByToken } from "@/lib/state";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const body = await req.json().catch(() => ({}));
  const token = body?.token as string;
  const isPublic = Boolean(body?.isPublic);

  const room = await getRoomByCode(code);
  if (!room) return Response.json({ error: "Room not found" }, { status: 404 });
  if (room.status !== "lobby")
    return Response.json({ error: "Can only change visibility in the lobby" }, { status: 400 });
  const me = token ? await getPlayerByToken(room.id, token) : null;
  if (!me?.isHost) return Response.json({ error: "Only the host can change this" }, { status: 403 });

  await db.update(rooms).set({ isPublic, updatedAt: new Date() }).where(eq(rooms.id, room.id));
  return Response.json({ ok: true, isPublic });
}
