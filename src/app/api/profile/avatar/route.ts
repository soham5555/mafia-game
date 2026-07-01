import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getUserByToken } from "@/lib/auth";
import { DEFAULT_AVATARS } from "@/lib/shop";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const token = (body?.authToken ?? body?.token) as string;
  const avatar = body?.avatar as string;

  const u = await getUserByToken(token);
  if (!u) return Response.json({ error: "Not authenticated" }, { status: 401 });

  // Owned = free defaults + anything purchased/gifted (built-in emoji or custom keys).
  const owned = [...DEFAULT_AVATARS, ...(u.ownedAvatars ?? [])];
  if (!owned.includes(avatar))
    return Response.json({ error: "You don't own that avatar" }, { status: 400 });

  await db.update(users).set({ avatar }).where(eq(users.id, u.id));
  return Response.json({ ok: true, avatar });
}
