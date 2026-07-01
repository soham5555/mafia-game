export interface ShopItem {
  key: string;
  name: string;
  emoji: string;
  price: number;
  description: string;
}

export const SHOP_ITEMS: ShopItem[] = [
  {
    key: "fake_id",
    name: "Forged Dossier (Fake Role)",
    emoji: "🎭",
    price: 150,
    description:
      "Works once. If the Commissioner, Journalist or Snitch checks you, your true identity stays hidden — you read as an innocent Civilian.",
  },
  {
    key: "vest",
    name: "Bulletproof Vest",
    emoji: "🦺",
    price: 200,
    description:
      "Works once. Survive a single night-time attack (does not stop the Assassin's unstoppable kill).",
  },
  {
    key: "alibi",
    name: "Ironclad Alibi",
    emoji: "📜",
    price: 250,
    description: "Works once. If the town votes to lynch you, the vote fails and you survive.",
  },
  {
    key: "double_vote",
    name: "Ballot Stuffer",
    emoji: "🗳️",
    price: 120,
    description: "Works once. Your daytime vote counts double for one day.",
  },
];

export const SHOP_MAP: Record<string, ShopItem> = Object.fromEntries(
  SHOP_ITEMS.map((i) => [i.key, i])
);

// Sell items back at 70% of purchase price (rounded).
export const SELL_RATE = 0.7;
export function sellPrice(price: number): number {
  return Math.round(price * SELL_RATE);
}

export interface AvatarItem {
  key: string; // the emoji itself acts as the key
  emoji: string;
  name: string;
  price: number;
}

// Free default avatars everyone owns, plus purchasable ones.
export const DEFAULT_AVATARS = ["🕵️", "🧑", "👩", "👮"];

export const AVATAR_SHOP: AvatarItem[] = [
  { key: "🤵", emoji: "🤵", name: "The Don", price: 300 },
  { key: "🎩", emoji: "🎩", name: "Top Hat", price: 200 },
  { key: "🦹", emoji: "🦹", name: "Villain", price: 350 },
  { key: "🧙", emoji: "🧙", name: "The Mage", price: 300 },
  { key: "🐺", emoji: "🐺", name: "Werewolf", price: 400 },
  { key: "👑", emoji: "👑", name: "Kingpin", price: 500 },
  { key: "🥷", emoji: "🥷", name: "Ninja", price: 350 },
  { key: "🤡", emoji: "🤡", name: "Wildcard", price: 250 },
  { key: "😎", emoji: "😎", name: "Slick", price: 150 },
  { key: "👽", emoji: "👽", name: "Outsider", price: 450 },
];

export const AVATAR_MAP: Record<string, AvatarItem> = Object.fromEntries(
  AVATAR_SHOP.map((a) => [a.key, a])
);

// Reward payouts
export const REWARD_WIN = 200;
export const REWARD_PARTICIPATE = 50;
