import { db } from "@/db";
import { customRoles } from "@/db/schema";
import { eq } from "drizzle-orm";
import { ROLES, type RoleDef } from "./roles";

/** Merge built-in roles with admin-created custom roles (vanilla, no night action). */
export async function getMergedRoles(): Promise<Record<string, RoleDef>> {
  const merged: Record<string, RoleDef> = { ...ROLES };
  const rows = await db.select().from(customRoles).where(eq(customRoles.active, true));
  for (const r of rows) {
    merged[r.roleKey] = {
      key: r.roleKey,
      name: r.name,
      team: r.team as RoleDef["team"],
      emoji: r.emoji,
      short: r.description,
      description: r.description,
      nightAction: false,
    };
  }
  return merged;
}

export async function getActiveCustomRoles() {
  return db.select().from(customRoles).where(eq(customRoles.active, true));
}
