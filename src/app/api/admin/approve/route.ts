import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getUserByToken } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const token = (body?.authToken ?? body?.token) as string;
  const targetId = body?.targetId as number;
  const decision = body?.decision as "yes" | "no";

  const admin = await getUserByToken(token);
  if (!admin?.isAdmin) return Response.json({ error: "Admin only" }, { status: 403 });
  if (!targetId) return Response.json({ error: "Missing target" }, { status: 400 });

  const target = await db.select().from(users).where(eq(users.id, targetId));
  if (!target[0] || target[0].isAdmin)
    return Response.json({ error: "Invalid target" }, { status: 400 });

  if (decision === "yes") {
    await db.update(users).set({ approved: true }).where(eq(users.id, targetId));
  } else {
    // deny = revoke access / delete account so they can't use it
    await db.delete(users).where(eq(users.id, targetId));
  }
  return Response.json({ ok: true });
}
