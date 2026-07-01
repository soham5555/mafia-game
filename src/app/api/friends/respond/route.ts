import { db } from "@/db";
import { users, friendships } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getUserByToken } from "@/lib/auth";
import { notify } from "@/lib/notify";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const token = body?.token as string;
  const relId = body?.relId as number;
  const decision = body?.decision as "accept" | "decline" | "remove";

  const u = await getUserByToken(token);
  if (!u) return Response.json({ error: "Not authenticated" }, { status: 401 });

  const rel = (await db.select().from(friendships).where(eq(friendships.id, relId)))[0];
  if (!rel) return Response.json({ error: "Not found" }, { status: 404 });
  if (rel.requesterId !== u.id && rel.addresseeId !== u.id)
    return Response.json({ error: "Not your request" }, { status: 403 });

  if (decision === "accept") {
    if (rel.addresseeId !== u.id)
      return Response.json({ error: "Only the recipient can accept" }, { status: 403 });
    await db.update(friendships).set({ status: "accepted" }).where(eq(friendships.id, relId));
    await notify(rel.requesterId, "friend", `✅ ${u.username} accepted your friend request.`);
  } else {
    // decline or remove -> delete the relationship
    await db.delete(friendships).where(eq(friendships.id, relId));
  }

  return Response.json({ ok: true });
}
