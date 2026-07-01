import { db } from "@/db";
import { users, customAvatars } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireAdmin } from "@/lib/admin";
import { notify } from "@/lib/notify";
import { getEffectiveItem } from "@/lib/content";
import { AVATAR_MAP } from "@/lib/shop";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const admin = await requireAdmin(body?.authToken ?? body?.token);
  if (!admin) return Response.json({ error: "Admin only" }, { status: 403 });

  const targetId = body?.targetId as number;
  const kind = body?.kind as "coins" | "item" | "avatar"; // "power" == item
  const value = body?.value as string; // itemKey or avatar key
  const amount = Number(body?.amount ?? 1);

  const target = (await db.select().from(users).where(eq(users.id, targetId)))[0];
  if (!target) return Response.json({ error: "User not found" }, { status: 404 });

  if (kind === "coins") {
    const add = Math.round(amount);
    await db.update(users).set({ coins: target.coins + add }).where(eq(users.id, targetId));
    await notify(targetId, "coins", `🎁 An admin gifted you ${add} 🪙 coins!`);
    return Response.json({ ok: true });
  }

  if (kind === "item") {
    const item = await getEffectiveItem(value);
    if (!item) return Response.json({ error: "Unknown item" }, { status: 400 });
    const inv = { ...(target.inventory ?? {}) };
    inv[value] = (inv[value] ?? 0) + Math.max(1, Math.round(amount));
    await db.update(users).set({ inventory: inv }).where(eq(users.id, targetId));
    await notify(targetId, "purchase", `🎁 An admin gifted you ${item.emoji} ${item.name}!`);
    return Response.json({ ok: true });
  }

  if (kind === "avatar") {
    let label: string;
    const av = AVATAR_MAP[value];
    if (av) {
      label = `${av.emoji} ${av.name}`;
    } else {
      const custom = (await db.select().from(customAvatars).where(eq(customAvatars.avatarKey, value)))[0];
      if (!custom) return Response.json({ error: "Unknown avatar" }, { status: 400 });
      label = `🖼️ ${custom.name}`;
    }
    const owned = [...(target.ownedAvatars ?? [])];
    if (!owned.includes(value)) owned.push(value);
    await db.update(users).set({ ownedAvatars: owned }).where(eq(users.id, targetId));
    await notify(targetId, "purchase", `🎁 An admin gifted you the ${label} avatar!`);
    return Response.json({ ok: true });
  }

  return Response.json({ error: "Unknown gift kind" }, { status: 400 });
}
