import { db } from "@/db";
import { customAvatars } from "@/db/schema";
import { resolveAvatar } from "@/lib/content";

export const dynamic = "force-dynamic";

// Public list of custom avatars with resolved sale pricing.
export async function GET() {
  const rows = await db.select().from(customAvatars);
  return Response.json({
    avatars: rows.map((r) => resolveAvatar(r)),
  });
}
