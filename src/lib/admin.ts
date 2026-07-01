import { getUserByToken } from "@/lib/auth";

/** Returns the admin user or null. */
export async function requireAdmin(token: string | null | undefined) {
  const u = await getUserByToken(token);
  if (!u || !u.isAdmin) return null;
  return u;
}

export function parseDurationMs(value: unknown): number | null {
  // value in minutes; 0 or falsy => permanent (null)
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n) * 60_000;
}
