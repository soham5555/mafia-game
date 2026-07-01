import { db } from "@/db";
import { notifications } from "@/db/schema";
import { and, eq, desc } from "drizzle-orm";
import { getUserByToken } from "@/lib/auth";

export const dynamic = "force-dynamic";

// GET: recent notifications + unread count
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token");
  const u = await getUserByToken(token);
  if (!u) return Response.json({ error: "Not authenticated" }, { status: 401 });

  const rows = await db
    .select()
    .from(notifications)
    .where(eq(notifications.userId, u.id))
    .orderBy(desc(notifications.createdAt))
    .limit(40);
  const unread = rows.filter((r) => !r.read).length;

  return Response.json({
    notifications: rows.map((r) => ({
      id: r.id,
      type: r.type,
      text: r.text,
      meta: r.meta,
      read: r.read,
      createdAt: r.createdAt,
    })),
    unread,
  });
}

// POST: mark all read
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const token = body?.token as string;
  const u = await getUserByToken(token);
  if (!u) return Response.json({ error: "Not authenticated" }, { status: 401 });
  await db
    .update(notifications)
    .set({ read: true })
    .where(and(eq(notifications.userId, u.id), eq(notifications.read, false)));
  return Response.json({ ok: true });
}
