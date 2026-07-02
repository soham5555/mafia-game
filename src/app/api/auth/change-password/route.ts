import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getUserByToken, verifyPassword, hashPassword, genSessionToken } from "@/lib/auth";
import { notify } from "@/lib/notify";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const token = body?.token as string;
  const currentPassword = body?.currentPassword as string;
  const newPassword = body?.newPassword as string;

  if (!token) return Response.json({ error: "Not authenticated" }, { status: 401 });
  if (!currentPassword || !newPassword)
    return Response.json({ error: "Current and new password required" }, { status: 400 });
  if (newPassword.length < 4)
    return Response.json({ error: "New password must be at least 4 characters" }, { status: 400 });

  const user = await getUserByToken(token);
  if (!user) return Response.json({ error: "Not authenticated" }, { status: 401 });

  if (!verifyPassword(currentPassword, user.passwordHash))
    return Response.json({ error: "Current password is incorrect" }, { status: 400 });

  // Generate a brand-new session token so all existing sessions are invalidated.
  const newSessionToken = genSessionToken();

  await db
    .update(users)
    .set({ passwordHash: hashPassword(newPassword), token: newSessionToken })
    .where(eq(users.id, user.id));

  // Notify the user their password was changed.
  await notify(
    user.id,
    "info",
    "🔑 Your password was changed successfully. All previous sessions have been logged out.",
    { event: "password_changed", at: new Date().toISOString() }
  );

  // Return the new token so the client can immediately re-authenticate.
  return Response.json({ ok: true, newToken: newSessionToken });
}
