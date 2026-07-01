import { getEffectiveItems } from "@/lib/content";
import { AVATAR_SHOP } from "@/lib/shop";

export const dynamic = "force-dynamic";

export async function GET() {
  const items = await getEffectiveItems();
  // Only show non-disabled items to players.
  const visible = items.filter((i) => !i.disabled);
  return Response.json({ items: visible, avatars: AVATAR_SHOP });
}
