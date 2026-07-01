import { db } from "@/db";
import { users, profileVisits } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { getUserByToken } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Recent visitors to my profile.
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const u = await getUserByToken(searchParams.get("token"));
  if (!u) return Response.json({ error: "Not authenticated" }, { status: 401 });

  const rows = await db
    .select()
    .from(profileVisits)
    .where(eq(profileVisits.profileUserId, u.id))
    .orderBy(desc(profileVisits.createdAt))
    .limit(50);

  const allUsers = await db.select().from(users);
  const nameOf = (id: number) => allUsers.find((x) => x.id === id);

  // De-duplicate by most recent visit per visitor.
  const seen = new Set<number>();
  const visitors: { username: string; avatar: string; at: string }[] = [];
  for (const r of rows) {
    if (seen.has(r.visitorUserId)) continue;
    seen.add(r.visitorUserId);
    const v = nameOf(r.visitorUserId);
    if (v) visitors.push({ username: v.username, avatar: v.avatar, at: r.createdAt.toISOString() });
  }

  return Response.json({ visitors, total: rows.length });
}
