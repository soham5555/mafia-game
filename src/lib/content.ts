import { db } from "@/db";
import { shopItems, siteText, customAvatars } from "@/db/schema";
import { eq } from "drizzle-orm";
import { SHOP_ITEMS, sellPrice, type ShopItem } from "./shop";

export interface EffectiveItem extends ShopItem {
  custom: boolean;
  disabled: boolean;
  discountPercent: number;
  discountName: string | null;
  effectivePrice: number;
  sellValue: number;
  saleStartsAt: string | null;
  saleEndsAt: string | null;
  saleUpcoming: boolean; // a discount is configured but hasn't started yet
  upcomingName: string | null;
  upcomingPercent: number;
  surprise: boolean;
}

/** Merge built-in items with DB overrides + admin custom items. */
export async function getEffectiveItems(): Promise<EffectiveItem[]> {
  const overrides = await db.select().from(shopItems);
  const overrideMap = new Map(overrides.map((o) => [o.itemKey, o]));
  const now = Date.now();

  const result: EffectiveItem[] = [];

  // built-ins first
  for (const base of SHOP_ITEMS) {
    const o = overrideMap.get(base.key);
    result.push(resolveItem(base, o, now, false));
  }
  // custom items (marked custom=true, and not shadowing a built-in)
  for (const o of overrides) {
    if (SHOP_ITEMS.some((b) => b.key === o.itemKey)) continue;
    if (!o.custom) continue;
    const base: ShopItem = {
      key: o.itemKey,
      name: o.name,
      emoji: o.emoji,
      price: o.price,
      description: o.description,
    };
    result.push(resolveItem(base, o, now, true));
  }
  return result;
}

type OverrideRow = typeof shopItems.$inferSelect;

function resolveItem(
  base: ShopItem,
  o: OverrideRow | undefined,
  now: number,
  custom: boolean
): EffectiveItem {
  const price = o?.price ?? base.price;
  let discountPercent = 0;
  let discountName: string | null = null;
  if (o && o.discountPercent > 0) {
    const started = !o.discountStartsAt || o.discountStartsAt.getTime() <= now;
    const notEnded = !o.discountUntil || o.discountUntil.getTime() > now;
    if (started && notEnded) {
      discountPercent = o.discountPercent;
      discountName = o.discountName ?? "Sale";
    }
  }
  const disabled = !!(o?.disabledUntil && o.disabledUntil.getTime() > now);
  const effectivePrice = Math.round(price * (1 - discountPercent / 100));

  // Upcoming (scheduled) sale that hasn't started yet.
  const saleUpcoming =
    !!(o && o.discountPercent > 0 && o.discountStartsAt && o.discountStartsAt.getTime() > now &&
      (!o.discountUntil || o.discountUntil.getTime() > now));
  const surprise = !!o?.discountSurprise;

  return {
    key: base.key,
    name: o?.name ?? base.name,
    emoji: o?.emoji ?? base.emoji,
    description: o?.description ?? base.description,
    price,
    custom,
    disabled,
    discountPercent,
    discountName,
    effectivePrice,
    sellValue: sellPrice(price),
    saleStartsAt: o?.discountStartsAt ? o.discountStartsAt.toISOString() : null,
    saleEndsAt: o?.discountUntil ? o.discountUntil.toISOString() : null,
    saleUpcoming,
    upcomingName: saleUpcoming ? o?.discountName ?? "Sale" : null,
    upcomingPercent: saleUpcoming ? o?.discountPercent ?? 0 : 0,
    surprise,
  };
}

export async function getEffectiveItem(key: string): Promise<EffectiveItem | null> {
  const items = await getEffectiveItems();
  return items.find((i) => i.key === key) ?? null;
}

export interface LaunchEvent {
  key: string;
  label: string; // item/avatar name, or "Mystery Deal" when surprise
  emoji: string; // emoji or "" for image avatars
  image: string | null; // custom avatar image or null
  kind: "item" | "avatar";
  status: "active" | "upcoming";
  percent: number; // hidden (0) when surprise
  saleName: string | null; // hidden when surprise
  startsAt: string | null;
  endsAt: string | null;
  surprise: boolean;
}

/** Active + upcoming sales for the main-menu launch-event ticker. */
export async function getLaunchEvents(): Promise<LaunchEvent[]> {
  const events: LaunchEvent[] = [];
  const items = await getEffectiveItems();
  for (const it of items) {
    const active = it.discountPercent > 0;
    if (!active && !it.saleUpcoming) continue;
    events.push({
      key: it.key,
      label: it.surprise ? "Mystery Deal" : it.name,
      emoji: it.surprise ? "🎁" : it.emoji,
      image: null,
      kind: "item",
      status: active ? "active" : "upcoming",
      percent: it.surprise ? 0 : active ? it.discountPercent : it.upcomingPercent,
      saleName: it.surprise ? null : active ? it.discountName : it.upcomingName,
      startsAt: it.saleStartsAt,
      endsAt: it.saleEndsAt,
      surprise: it.surprise,
    });
  }

  const avatarRows = await db.select().from(customAvatars);
  for (const row of avatarRows) {
    const a = resolveAvatar(row);
    const active = a.discountPercent > 0;
    if (!active && !a.saleUpcoming) continue;
    events.push({
      key: a.key,
      label: a.surprise ? "Mystery Avatar" : a.name,
      emoji: a.surprise ? "🎁" : "",
      image: a.surprise ? null : a.image,
      kind: "avatar",
      status: active ? "active" : "upcoming",
      percent: a.surprise ? 0 : active ? a.discountPercent : a.upcomingPercent,
      saleName: a.surprise ? null : active ? a.discountName : a.upcomingName,
      startsAt: a.saleStartsAt,
      endsAt: a.saleEndsAt,
      surprise: a.surprise,
    });
  }

  // Upcoming first (by soonest start), then active (by soonest end).
  events.sort((x, y) => {
    const xt = x.status === "upcoming" ? new Date(x.startsAt ?? 0).getTime() : new Date(x.endsAt ?? 8e15).getTime();
    const yt = y.status === "upcoming" ? new Date(y.startsAt ?? 0).getTime() : new Date(y.endsAt ?? 8e15).getTime();
    return xt - yt;
  });
  return events;
}

// ---- Custom avatar sale resolution ----
export interface EffectiveAvatar {
  key: string;
  name: string;
  image: string;
  price: number;
  effectivePrice: number;
  discountPercent: number;
  discountName: string | null;
  saleUpcoming: boolean;
  upcomingName: string | null;
  upcomingPercent: number;
  saleStartsAt: string | null;
  saleEndsAt: string | null;
  surprise: boolean;
}

type AvatarRow = {
  avatarKey: string;
  name: string;
  image: string;
  price: number;
  discountPercent: number;
  discountName: string | null;
  discountStartsAt: Date | null;
  discountUntil: Date | null;
  discountSurprise?: boolean;
};

export function resolveAvatar(a: AvatarRow, now = Date.now()): EffectiveAvatar {
  let discountPercent = 0;
  let discountName: string | null = null;
  if (a.discountPercent > 0) {
    const started = !a.discountStartsAt || a.discountStartsAt.getTime() <= now;
    const notEnded = !a.discountUntil || a.discountUntil.getTime() > now;
    if (started && notEnded) {
      discountPercent = a.discountPercent;
      discountName = a.discountName ?? "Sale";
    }
  }
  const saleUpcoming =
    a.discountPercent > 0 &&
    !!a.discountStartsAt &&
    a.discountStartsAt.getTime() > now &&
    (!a.discountUntil || a.discountUntil.getTime() > now);
  return {
    key: a.avatarKey,
    name: a.name,
    image: a.image,
    price: a.price,
    effectivePrice: Math.round(a.price * (1 - discountPercent / 100)),
    discountPercent,
    discountName,
    saleUpcoming,
    upcomingName: saleUpcoming ? a.discountName ?? "Sale" : null,
    upcomingPercent: saleUpcoming ? a.discountPercent : 0,
    saleStartsAt: a.discountStartsAt ? a.discountStartsAt.toISOString() : null,
    saleEndsAt: a.discountUntil ? a.discountUntil.toISOString() : null,
    surprise: !!a.discountSurprise,
  };
}

// ---- Site text ----
export const DEFAULT_TEXTS: Record<string, string> = {
  title: "MAFIA: The City",
  tagline: "Commissioner Cattani vs. The Mob — real-time social deduction",
  footerNote: "Play on any phone or computer browser. Share the room code with friends.",
  footerLinkLabel: "🌐 mafia-the-city.example.com",
  footerLinkUrl: "https://mafia-the-city.example.com",
};

export async function getTexts(): Promise<Record<string, string>> {
  const rows = await db.select().from(siteText);
  const map: Record<string, string> = { ...DEFAULT_TEXTS };
  for (const r of rows) map[r.key] = r.value;
  return map;
}

export async function setText(key: string, value: string) {
  const existing = await db.select().from(siteText).where(eq(siteText.key, key));
  if (existing.length > 0) {
    await db.update(siteText).set({ value, updatedAt: new Date() }).where(eq(siteText.key, key));
  } else {
    await db.insert(siteText).values({ key, value });
  }
}
