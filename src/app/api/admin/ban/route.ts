import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireAdmin, parseDurationMs } from "@/lib/admin";
import { notify } from "@/lib/notify";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const admin = await requireAdmin(body?.authToken ?? body?.token);
  if (!admin) return Response.json({ error: "Admin only" }, { status: 403 });

  const targetId = body?.targetId as number;
  const action = body?.action as "ban" | "unban";
  const reason = (body?.reason as string) || "Violation of rules";
  const minutes = body?.minutes; // 0/empty = permanent

  const target = (await db.select().from(users).where(eq(users.id, targetId)))[0];
  if (!target) return Response.json({ error: "User not found" }, { status: 404 });
  if (target.isAdmin) return Response.json({ error: "Cannot ban an admin" }, { status: 400 });

  if (action === "unban") {
    await db
      .update(users)
      .set({ banned: false, bannedUntil: null, banReason: null })
      .where(eq(users.id, targetId));
    await notify(targetId, "info", "✅ Your ban has been lifted. Welcome back!");
    return Response.json({ ok: true });
  }

  const durMs = parseDurationMs(minutes);
  const until = durMs ? new Date(Date.now() + durMs) : null;
  await db
    .update(users)
    .set({ banned: true, bannedUntil: until, banReason: reason })
    .where(eq(users.id, targetId));
  const when = until
    ? `until ${until.toLocaleString()}`
    : "permanently";
  await notify(targetId, "info", `⛔ You have been banned ${when}. Reason: ${reason}`);

  return Response.json({ ok: true });
}
