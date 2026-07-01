import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getUserByToken } from "@/lib/auth";
import { notify } from "@/lib/notify";
import { getEffectiveItem } from "@/lib/content";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const token = (body?.authToken ?? body?.token) as string;
  const itemKey = body?.itemKey as string;

  const u = await getUserByToken(token);
  if (!u) return Response.json({ error: "Not authenticated" }, { status: 401 });
  if (u.banned) return Response.json({ error: "You are banned" }, { status: 403 });

  // Avatars are permanent and cannot be sold.
  if (typeof itemKey === "string" && itemKey.startsWith("cav_"))
    return Response.json({ error: "Avatars cannot be sold" }, { status: 400 });

  const item = await getEffectiveItem(itemKey);
  if (!item) return Response.json({ error: "Avatars and unknown items cannot be sold" }, { status: 400 });

  const inv = { ...(u.inventory ?? {}) };
  if ((inv[itemKey] ?? 0) < 1)
    return Response.json({ error: "You don't own that item" }, { status: 400 });

  inv[itemKey] = inv[itemKey] - 1;
  if (inv[itemKey] <= 0) delete inv[itemKey];
  const refund = item.sellValue;
  const newCoins = u.coins + refund;
  await db.update(users).set({ coins: newCoins, inventory: inv }).where(eq(users.id, u.id));
  await notify(u.id, "sale", `+${refund} 🪙 from selling ${item.emoji} ${item.name} (70% of ${item.price}).`);

  return Response.json({ ok: true, coins: newCoins, inventory: inv, refund });
}
