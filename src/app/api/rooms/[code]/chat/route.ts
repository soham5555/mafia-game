import { db } from "@/db";
import { messages } from "@/db/schema";
import { getRoomByCode, getPlayerByToken } from "@/lib/state";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const body = await req.json().catch(() => ({}));
  const token = body?.token as string;
  const text = (body?.text as string)?.trim();
  let channel = (body?.channel as string) || "day";

  if (!text) return Response.json({ error: "Empty message" }, { status: 400 });
  const room = await getRoomByCode(code);
  if (!room) return Response.json({ error: "Room not found" }, { status: 404 });
  const me = token ? await getPlayerByToken(room.id, token) : null;
  if (!me) return Response.json({ error: "Not in room" }, { status: 403 });

  // channel permissions
  if (channel === "mafia" && me.team !== "mafia")
    return Response.json({ error: "Not mafia" }, { status: 403 });
  if (!me.alive && channel === "day") channel = "dead";
  if (channel === "dead" && me.alive)
    return Response.json({ error: "You are alive" }, { status: 403 });

  // living players may only use day chat during day phase
  if (me.alive && channel === "day" && room.status === "night")
    return Response.json({ error: "The town is asleep" }, { status: 400 });

  await db.insert(messages).values({
    roomId: room.id,
    channel,
    senderId: me.id,
    senderName: me.name,
    text: text.slice(0, 300),
  });

  return Response.json({ ok: true });
}
