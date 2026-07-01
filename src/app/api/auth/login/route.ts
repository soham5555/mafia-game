import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { ensureAdmin, verifyPassword, genSessionToken } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  await ensureAdmin();
  const body = await req.json().catch(() => ({}));
  const username = (body?.username as string)?.trim();
  const password = body?.password as string;
  if (!username || !password)
    return Response.json({ error: "Username and password required" }, { status: 400 });

  const found = await db.select().from(users).where(eq(users.username, username));
  const u = found[0];
  if (!u || !verifyPassword(password, u.passwordHash))
    return Response.json({ error: "Invalid username or password" }, { status: 401 });

  const token = genSessionToken();
  await db.update(users).set({ token }).where(eq(users.id, u.id));
  return Response.json({
    token,
    user: {
      username: u.username,
      coins: u.coins,
      approved: u.approved,
      isAdmin: u.isAdmin,
      avatar: u.avatar,
      ownedAvatars: u.ownedAvatars ?? [],
      inventory: u.inventory ?? {},
    },
  });
}
