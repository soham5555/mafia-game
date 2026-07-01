import { db } from "@/db";
import { players, users, rooms } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getRoomByCode, getPlayerByToken } from "@/lib/state";
import { sysMessage, checkWin } from "@/lib/engine";
import { notify } from "@/lib/notify";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const body = await req.json().catch(() => ({}));
  const token = body?.token as string;

  const room = await getRoomByCode(code);
  if (!room) return Response.json({ error: "Room not found" }, { status: 404 });
  const me = token ? await getPlayerByToken(room.id, token) : null;
  if (!me) return Response.json({ error: "Not in room" }, { status: 403 });

  // In lobby: host leaving closes the room for everyone (no punishment).
  if (room.status === "lobby") {
    if (me.isHost) {
      // release all players and close the room
      await db.update(players).set({ leftGame: true }).where(eq(players.roomId, room.id));
      await db
        .update(rooms)
        .set({ status: "closed", updatedAt: new Date() })
        .where(eq(rooms.id, room.id));
    } else {
      await db.delete(players).where(eq(players.id, me.id));
    }
  } else if (room.status !== "ended" && room.status !== "closed") {
    await db
      .update(players)
      .set({
        alive: false,
        leftGame: true,
        state: { ...(me.state ?? {}), diedAt: "left", diedDay: room.dayNumber },
      })
      .where(eq(players.id, me.id));
    await sysMessage(room.id, `🚪 ${me.name} left the game and was eliminated.`);
    if (me.userId) {
      const u = (await db.select().from(users).where(eq(users.id, me.userId)))[0];
      if (u) {
        const penalty = Math.min(100, u.coins);
        await db.update(users).set({ coins: u.coins - penalty }).where(eq(users.id, u.id));
        await notify(u.id, "coins", `−${penalty} 🪙 penalty for leaving a game.`);
      }
    }
    await checkWin(room.id);
  } else {
    // ended: just release the slot
    await db.update(players).set({ leftGame: true }).where(eq(players.id, me.id));
  }

  return Response.json({ ok: true });
}
