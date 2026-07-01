import { db } from "@/db";
import { users, friendships, matchHistory, profileVisits } from "@/db/schema";
import { and, eq, or } from "drizzle-orm";
import { getUserByToken } from "@/lib/auth";

export const dynamic = "force-dynamic";

// GET /api/profile?token=..&username=..  -> view a profile (records a visit)
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token");
  const username = (searchParams.get("username") ?? "").trim();
  const viewer = await getUserByToken(token);
  if (!viewer) return Response.json({ error: "Not authenticated" }, { status: 401 });
  if (!username) return Response.json({ error: "username required" }, { status: 400 });

  const target = (await db.select().from(users).where(eq(users.username, username)))[0];
  if (!target) return Response.json({ error: "User not found" }, { status: 404 });

  const isSelf = target.id === viewer.id;

  // Are they friends?
  const rel = (
    await db
      .select()
      .from(friendships)
      .where(
        or(
          and(eq(friendships.requesterId, viewer.id), eq(friendships.addresseeId, target.id)),
          and(eq(friendships.requesterId, target.id), eq(friendships.addresseeId, viewer.id))
        )
      )
  )[0];
  const areFriends = rel?.status === "accepted";

  // Record a visit (not for self, once we know it's another user).
  if (!isSelf) {
    await db.insert(profileVisits).values({ profileUserId: target.id, visitorUserId: viewer.id });
  }

  // Stats
  const rows = await db.select().from(matchHistory).where(eq(matchHistory.userId, target.id));
  const wins = rows.filter((r) => r.result === "win").length;
  const losses = rows.filter((r) => r.result === "lose").length;

  const canSeeAchievements = isSelf || target.profilePublic || areFriends;

  return Response.json({
    profile: {
      username: target.username,
      avatar: target.avatar,
      isSelf,
      areFriends,
      profilePublic: target.profilePublic,
      canSeeAchievements,
      relStatus: rel ? (rel.status === "accepted" ? "friends" : rel.requesterId === viewer.id ? "outgoing" : "incoming") : "none",
      stats: canSeeAchievements ? { wins, losses, total: rows.length } : null,
    },
  });
}
