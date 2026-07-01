import { db } from "@/db";
import { rooms, players } from "@/db/schema";
import { and, eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

// GET: list/search public rooms in lobby state.
// ?q= optional filter by host username or code.
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") ?? "").trim().toLowerCase();

  const openRooms = await db
    .select()
    .from(rooms)
    .where(and(eq(rooms.isPublic, true), eq(rooms.status, "lobby")));

  const result = [];
  for (const r of openRooms) {
    if (q && !r.hostName.toLowerCase().includes(q) && !r.code.toLowerCase().includes(q)) {
      continue;
    }
    const roster = await db.select().from(players).where(eq(players.roomId, r.id));
    result.push({
      code: r.code,
      hostName: r.hostName,
      playerCount: roster.length,
      createdAt: r.createdAt,
    });
  }
  // newest first
  result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return Response.json({ rooms: result.slice(0, 30) });
}
