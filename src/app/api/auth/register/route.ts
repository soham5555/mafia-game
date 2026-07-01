import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { ensureAdmin, hashPassword, genSessionToken, isAdminUsername } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  await ensureAdmin();
  const body = await req.json().catch(() => ({}));
  const username = (body?.username as string)?.trim();
  const password = body?.password as string;
  if (!username || username.length < 3)
    return Response.json({ error: "Username must be at least 3 characters" }, { status: 400 });
  if (!password || password.length < 4)
    return Response.json({ error: "Password must be at least 4 characters" }, { status: 400 });
  if (isAdminUsername(username))
    return Response.json({ error: "That username is reserved" }, { status: 400 });

  const existing = await db
    .select()
    .from(users)
    .where(eq(users.username, username));
  if (existing.length > 0)
    return Response.json({ error: "Username already taken" }, { status: 400 });

  const token = genSessionToken();
  const inserted = await db
    .insert(users)
    .values({
      username: username.slice(0, 20),
      passwordHash: hashPassword(password),
      token,
      approved: false,
      isAdmin: false,
    })
    .returning();
  const u = inserted[0];
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
