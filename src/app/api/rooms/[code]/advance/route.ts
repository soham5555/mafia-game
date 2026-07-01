import { getRoomByCode, getPlayerByToken } from "@/lib/state";
import { resolveNight, resolveDay } from "@/lib/engine";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const body = await req.json().catch(() => ({}));
  const token = body?.token as string;

  const room = await getRoomByCode(code);
  if (!room) return Response.json({ error: "Room not found" }, { status: 404 });
  const me = token ? await getPlayerByToken(room.id, token) : null;
  if (!me?.isHost) return Response.json({ error: "Only the host can advance" }, { status: 403 });

  if (room.status === "night") {
    await resolveNight(room.id);
  } else if (room.status === "day") {
    await resolveDay(room.id);
  } else {
    return Response.json({ error: "Cannot advance now" }, { status: 400 });
  }

  return Response.json({ ok: true });
}
