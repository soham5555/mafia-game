import { db } from "@/db";
import { matchHistory } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { getUserByToken } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token");
  const u = await getUserByToken(token);
  if (!u) return Response.json({ error: "Not authenticated" }, { status: 401 });

  const rows = await db
    .select()
    .from(matchHistory)
    .where(eq(matchHistory.userId, u.id))
    .orderBy(desc(matchHistory.createdAt))
    .limit(50);

  const wins = rows.filter((r) => r.result === "win").length;
  const losses = rows.filter((r) => r.result === "lose").length;

  return Response.json({
    history: rows.map((r) => ({
      id: r.id,
      roomCode: r.roomCode,
      role: r.role,
      team: r.team,
      result: r.result,
      createdAt: r.createdAt,
    })),
    wins,
    losses,
    total: rows.length,
  });
}
