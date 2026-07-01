import { db } from "@/db";
import { users, friendships } from "@/db/schema";
import { eq, or, and } from "drizzle-orm";
import { getUserByToken } from "@/lib/auth";
import { notify } from "@/lib/notify";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const token = body?.token as string;
  const targetId = body?.targetId as number;

  const username = (body?.username as string)?.trim();
  const u = await getUserByToken(token);
  if (!u) return Response.json({ error: "Not authenticated" }, { status: 401 });

  let target;
  if (targetId) {
    target = (await db.select().from(users).where(eq(users.id, targetId)))[0];
  } else if (username) {
    target = (await db.select().from(users).where(eq(users.username, username)))[0];
  }
  if (!target) return Response.json({ error: "User not found" }, { status: 404 });
  if (target.id === u.id) return Response.json({ error: "That's you!" }, { status: 400 });
  const resolvedTargetId = target.id;

  const existing = await db
    .select()
    .from(friendships)
    .where(
      or(
        and(eq(friendships.requesterId, u.id), eq(friendships.addresseeId, resolvedTargetId)),
        and(eq(friendships.requesterId, resolvedTargetId), eq(friendships.addresseeId, u.id))
      )
    );
  if (existing.length > 0)
    return Response.json({ error: "Request already exists" }, { status: 400 });

  await db.insert(friendships).values({
    requesterId: u.id,
    addresseeId: resolvedTargetId,
    status: "pending",
  });
  await notify(resolvedTargetId, "friend", `👋 ${u.username} sent you a friend request.`);

  return Response.json({ ok: true });
}
