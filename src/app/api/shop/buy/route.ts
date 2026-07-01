import { db } from "@/db";
import { users, customAvatars } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getUserByToken } from "@/lib/auth";
import { AVATAR_MAP } from "@/lib/shop";
import { notify } from "@/lib/notify";
import { getEffectiveItem, resolveAvatar } from "@/lib/content";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const token = (body?.authToken ?? body?.token) as string;
  const itemKey = body?.itemKey as string;
  const kind = (body?.kind as string) || "item"; // "item" | "avatar"

  const u = await getUserByToken(token);
  if (!u) return Response.json({ error: "Not authenticated" }, { status: 401 });
  if (u.banned) return Response.json({ error: "You are banned" }, { status: 403 });
  if (!u.approved) return Response.json({ error: "Account not approved yet" }, { status: 403 });

  if (kind === "avatar") {
    // Resolve either a built-in emoji avatar or an admin-uploaded custom avatar.
    let avName: string;
    let avPrice: number;
    let avLabel: string;
    const builtin = AVATAR_MAP[itemKey];
    if (builtin) {
      avName = builtin.name;
      avPrice = builtin.price;
      avLabel = `${builtin.emoji} ${builtin.name}`;
    } else {
      const custom = (await db.select().from(customAvatars).where(eq(customAvatars.avatarKey, itemKey)))[0];
      if (!custom) return Response.json({ error: "Unknown avatar" }, { status: 400 });
      const eff = resolveAvatar(custom);
      avName = custom.name;
      avPrice = eff.effectivePrice; // apply active sale
      avLabel = `🖼️ ${custom.name}`;
    }

    const owned = [...(u.ownedAvatars ?? [])];
    // Limit: only one of each avatar per player.
    if (owned.includes(itemKey))
      return Response.json({ error: "You already own this avatar" }, { status: 400 });
    if (u.coins < avPrice)
      return Response.json({ error: "Not enough coins" }, { status: 400 });
    owned.push(itemKey);
    const newCoins = u.coins - avPrice;
    await db.update(users).set({ coins: newCoins, ownedAvatars: owned }).where(eq(users.id, u.id));
    await notify(u.id, "coins", `−${avPrice} 🪙 spent on the ${avName} avatar.`);
    await notify(u.id, "purchase", `🎉 Congratulations! You unlocked the ${avLabel} avatar.`);
    return Response.json({ ok: true, coins: newCoins, ownedAvatars: owned });
  }

  const item = await getEffectiveItem(itemKey);
  if (!item) return Response.json({ error: "Unknown item" }, { status: 400 });
  if (item.disabled) return Response.json({ error: "This item is currently unavailable" }, { status: 400 });
  const price = item.effectivePrice;
  if (u.coins < price) return Response.json({ error: "Not enough coins" }, { status: 400 });

  const inv = { ...(u.inventory ?? {}) };
  inv[itemKey] = (inv[itemKey] ?? 0) + 1;
  const newCoins = u.coins - price;
  await db.update(users).set({ coins: newCoins, inventory: inv }).where(eq(users.id, u.id));
  const saleNote = item.discountPercent > 0 ? ` (${item.discountName} −${item.discountPercent}%)` : "";
  await notify(u.id, "coins", `−${price} 🪙 deducted for ${item.name}${saleNote}.`);
  await notify(u.id, "purchase", `🎉 Congratulations! You bought ${item.emoji} ${item.name}.`);

  return Response.json({ ok: true, coins: newCoins, inventory: inv });
}
