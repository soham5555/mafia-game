import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import crypto from "crypto";

const ADMIN_USERNAME = "SOHAM";
const ADMIN_PASSWORD = "SOHAM@ADMIN123";

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const test = crypto.scryptSync(password, salt, 64).toString("hex");
  const a = Buffer.from(hash, "hex");
  const b = Buffer.from(test, "hex");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export function genSessionToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

/** Ensure the admin account exists. Called before auth operations. */
export async function ensureAdmin() {
  const existing = await db.select().from(users).where(eq(users.username, ADMIN_USERNAME));
  if (existing.length === 0) {
    await db.insert(users).values({
      username: ADMIN_USERNAME,
      passwordHash: hashPassword(ADMIN_PASSWORD),
      approved: true,
      isAdmin: true,
      coins: 999999,
    });
  }
}

export async function getUserByToken(token: string | null | undefined) {
  if (!token) return null;
  const r = await db.select().from(users).where(eq(users.token, token));
  const u = r[0];
  if (!u) return null;
  // Auto-unban if the ban timer has expired.
  if (u.banned && u.bannedUntil && u.bannedUntil.getTime() <= Date.now()) {
    await db
      .update(users)
      .set({ banned: false, bannedUntil: null, banReason: null })
      .where(eq(users.id, u.id));
    u.banned = false;
    u.bannedUntil = null;
    u.banReason = null;
  }
  return u;
}

export type BanInfo = { banned: boolean; until: string | null; reason: string | null };

export function banInfo(u: { banned: boolean; bannedUntil: Date | null; banReason: string | null }): BanInfo {
  return {
    banned: u.banned,
    until: u.bannedUntil ? u.bannedUntil.toISOString() : null,
    reason: u.banReason ?? null,
  };
}

export function isAdminUsername(name: string) {
  return name.trim().toUpperCase() === ADMIN_USERNAME;
}

export { ADMIN_USERNAME };
