import { db } from "@/db";
import { shopItems } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireAdmin } from "@/lib/admin";
import { SHOP_ITEMS } from "@/lib/shop";
import { getEffectiveItems } from "@/lib/content";

export const dynamic = "force-dynamic";

// GET: list effective items (admin view)
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const admin = await requireAdmin(searchParams.get("token"));
  if (!admin) return Response.json({ error: "Admin only" }, { status: 403 });
  const items = await getEffectiveItems();
  return Response.json({ items });
}

function minutesFromNow(mins: unknown): Date | null {
  const n = Number(mins);
  if (!Number.isFinite(n) || n <= 0) return null;
  return new Date(Date.now() + Math.round(n) * 60_000);
}

async function upsert(itemKey: string, patch: Record<string, unknown>) {
  const existing = await db.select().from(shopItems).where(eq(shopItems.itemKey, itemKey));
  if (existing.length > 0) {
    await db.update(shopItems).set(patch).where(eq(shopItems.itemKey, itemKey));
  } else {
    // seed row from built-in defaults if it's a built-in override
    const base = SHOP_ITEMS.find((b) => b.key === itemKey);
    await db.insert(shopItems).values({
      itemKey,
      name: (patch.name as string) ?? base?.name ?? itemKey,
      emoji: (patch.emoji as string) ?? base?.emoji ?? "🎁",
      description: (patch.description as string) ?? base?.description ?? "",
      price: (patch.price as number) ?? base?.price ?? 100,
      kind: (patch.kind as string) ?? "item",
      custom: base ? false : true,
      ...patch,
    });
  }
}

// POST: create/update/discount/disable/delete
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const admin = await requireAdmin(body?.authToken ?? body?.token);
  if (!admin) return Response.json({ error: "Admin only" }, { status: 403 });

  const op = body?.op as string;
  const itemKey = (body?.itemKey as string)?.trim();
  if (!itemKey) return Response.json({ error: "itemKey required" }, { status: 400 });

  if (op === "create") {
    const exists =
      SHOP_ITEMS.some((b) => b.key === itemKey) ||
      (await db.select().from(shopItems).where(eq(shopItems.itemKey, itemKey))).length > 0;
    if (exists) return Response.json({ error: "Item key already exists" }, { status: 400 });
    await db.insert(shopItems).values({
      itemKey,
      name: (body?.name as string) || itemKey,
      emoji: (body?.emoji as string) || "🎁",
      description: (body?.description as string) || "",
      price: Math.max(0, Math.round(Number(body?.price) || 100)),
      kind: "item",
      custom: true,
    });
    return Response.json({ ok: true });
  }

  if (op === "price") {
    await upsert(itemKey, { price: Math.max(0, Math.round(Number(body?.price) || 0)) });
    return Response.json({ ok: true });
  }

  if (op === "discount") {
    // startMinutes = when the sale begins (0/empty = now).
    // endMinutes = when it ends (0/empty = never). If both given, endMinutes is
    // measured from now as well.
    await upsert(itemKey, {
      discountPercent: Math.min(90, Math.max(0, Math.round(Number(body?.discountPercent) || 0))),
      discountName: (body?.discountName as string) || "Sale",
      discountStartsAt: minutesFromNow(body?.startMinutes),
      discountUntil: minutesFromNow(body?.endMinutes ?? body?.minutes),
      discountSurprise: Boolean(body?.surprise),
    });
    return Response.json({ ok: true });
  }

  if (op === "disable") {
    await upsert(itemKey, { disabledUntil: minutesFromNow(body?.minutes) ?? new Date(Date.now() + 3650 * 864e5) });
    return Response.json({ ok: true });
  }

  if (op === "enable") {
    await upsert(itemKey, {
      disabledUntil: null,
      discountPercent: 0,
      discountName: null,
      discountStartsAt: null,
      discountUntil: null,
      discountSurprise: false,
    });
    return Response.json({ ok: true });
  }

  if (op === "delete") {
    // only custom items can be deleted; built-ins just get reset
    await db.delete(shopItems).where(eq(shopItems.itemKey, itemKey));
    return Response.json({ ok: true });
  }

  return Response.json({ error: "Unknown op" }, { status: 400 });
}
