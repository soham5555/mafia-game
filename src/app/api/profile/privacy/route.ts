import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getUserByToken } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const token = (body?.authToken ?? body?.token) as string;
  const isPublic = Boolean(body?.isPublic);
  const u = await getUserByToken(token);
  if (!u) return Response.json({ error: "Not authenticated" }, { status: 401 });
  await db.update(users).set({ profilePublic: isPublic }).where(eq(users.id, u.id));
  return Response.json({ ok: true, profilePublic: isPublic });
}
