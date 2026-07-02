import { db } from "@/db";
import { actions, players } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { getRoomByCode, getPlayerByToken } from "@/lib/state";
import { ROLES } from "@/lib/roles";
import { emitEvent, sysMessage } from "@/lib/engine";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const body = await req.json().catch(() => ({}));
  const token = body?.token as string;
  const targetId = body?.targetId as number | null;
  const actionType = (body?.actionType as string) || "action";

  const room = await getRoomByCode(code);
  if (!room) return Response.json({ error: "Room not found" }, { status: 404 });
  if (room.status !== "night")
    return Response.json({ error: "Not night phase" }, { status: 400 });
  const me = token ? await getPlayerByToken(room.id, token) : null;
  if (!me || !me.alive) return Response.json({ error: "Cannot act" }, { status: 403 });
  const def = me.role ? ROLES[me.role] : null;
  if (!def?.nightAction)
    return Response.json({ error: "No night action" }, { status: 400 });

  // validate target exists and alive if provided
  if (targetId != null) {
    const t = await db
      .select()
      .from(players)
      .where(and(eq(players.roomId, room.id), eq(players.id, targetId)));
    if (!t[0]) return Response.json({ error: "Invalid target" }, { status: 400 });
    if (!def.canTargetSelf && t[0].id === me.id)
      return Response.json({ error: "Cannot target self" }, { status: 400 });
  }

  // delete existing action for this actor tonight
  await db
    .delete(actions)
    .where(
      and(
        eq(actions.roomId, room.id),
        eq(actions.dayNumber, room.dayNumber),
        eq(actions.actorId, me.id)
      )
    );
  await db.insert(actions).values({
    roomId: room.id,
    dayNumber: room.dayNumber,
    actorId: me.id,
    targetId: targetId ?? null,
    actionType,
  });

  // ---- Narrated role-flavored chat messages (visible to all) ----
  const roleNarratorMessages: Record<string, string> = {
    doctor: "🩺 The Doctor grabbed their medical bag and went on a late-night house call…",
    don: "🤵 A shadowy figure stepped out of a black sedan… The Don has made his move.",
    mafia: "🔫 Footsteps echo in the alley… someone from the family is on the hunt.",
    assassin: "🗡️ A cold breeze sweeps through the city… The Assassin slips into the shadows.",
    commissioner: "🕵️ The Commissioner lit a cigarette and opened a case file… an investigation has begun.",
    mistress: "💋 The Mistress put on her red dress and went out looking for company tonight…",
    hobo: "🍷 The Hobo wandered the streets and found a doorstep to crash on for the night…",
    maniac: "🔪 Something stirred in the darkness… a predator is loose in the city.",
    lawyer: "⚖️ The Lawyer made a phone call… someone's alibi just got airtight.",
    journalist: "📰 The Journalist sharpened their pencil and started digging for dirt…",
    arsonist: "🔥 The smell of gasoline drifts through the neighborhood…",
    snitch: "🐍 A pair of eyes watched from behind a curtain… The Snitch is on the move.",
    conartist: "🃏 A charming stranger knocked on someone's door tonight…",
  };
  const narratorMsg = roleNarratorMessages[me.role ?? ""];
  if (narratorMsg) {
    await sysMessage(room.id, narratorMsg);
  }

  // Real-time sound/animation events.
  // The Don's gunshot rings across the whole city — everyone hears it.
  if (me.role === "don" && targetId != null) {
    await emitEvent(room.id, "gunshot", "all", { actorId: me.id });
  } else if (me.role === "assassin" && targetId != null) {
    await emitEvent(room.id, "gunshot", "all", { actorId: me.id });
  } else if (me.role === "maniac" && targetId != null) {
    // maniac uses a knife — a scream only the maniac's own screen animates,
    // but a faint sound plays for all
    await emitEvent(room.id, "stab", "all", { actorId: me.id });
  }

  return Response.json({ ok: true });
}
