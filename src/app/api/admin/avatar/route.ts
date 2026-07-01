import { db } from "@/db";
import { customAvatars } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireAdmin } from "@/lib/admin";

export const dynamic = "force-dynamic";

// Roughly cap stored data URL size (~256x256 JPEG is well under this).
const MAX_IMAGE_CHARS = 400_000;

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const admin = await requireAdmin(body?.authToken ?? body?.token);
  if (!admin) return Response.json({ error: "Admin only" }, { status: 403 });

  const op = body?.op as string;

  const minutesFromNow = (mins: unknown): Date | null => {
    const n = Number(mins);
    if (!Number.isFinite(n) || n <= 0) return null;
    return new Date(Date.now() + Math.round(n) * 60_000);
  };

  if (op === "delete") {
    await db.delete(customAvatars).where(eq(customAvatars.avatarKey, body?.avatarKey as string));
    return Response.json({ ok: true });
  }

  if (op === "price") {
    await db
      .update(customAvatars)
      .set({ price: Math.max(0, Math.round(Number(body?.price) || 0)) })
      .where(eq(customAvatars.avatarKey, body?.avatarKey as string));
    return Response.json({ ok: true });
  }

  if (op === "discount") {
    await db
      .update(customAvatars)
      .set({
        discountPercent: Math.min(90, Math.max(0, Math.round(Number(body?.discountPercent) || 0))),
        discountName: (body?.discountName as string) || "Launch Event",
        discountStartsAt: minutesFromNow(body?.startMinutes),
        discountUntil: minutesFromNow(body?.endMinutes),
        discountSurprise: Boolean(body?.surprise),
      })
      .where(eq(customAvatars.avatarKey, body?.avatarKey as string));
    return Response.json({ ok: true });
  }

  if (op === "clearSale") {
    await db
      .update(customAvatars)
      .set({ discountPercent: 0, discountName: null, discountStartsAt: null, discountUntil: null, discountSurprise: false })
      .where(eq(customAvatars.avatarKey, body?.avatarKey as string));
    return Response.json({ ok: true });
  }

  if (op === "create") {
    const name = (body?.name as string)?.trim();
    const image = body?.image as string;
    const price = Math.max(0, Math.round(Number(body?.price) || 300));
    if (!name) return Response.json({ error: "Name required" }, { status: 400 });
    if (!image || !/^data:image\/(png|jpeg|jpg|webp);base64,/.test(image))
      return Response.json({ error: "A valid image is required" }, { status: 400 });
    if (image.length > MAX_IMAGE_CHARS)
      return Response.json({ error: "Image too large — use a smaller photo" }, { status: 400 });

    const avatarKey =
      "cav_" + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);
    await db.insert(customAvatars).values({ avatarKey, name, image, price });
    return Response.json({ ok: true, avatarKey });
  }

  return Response.json({ error: "Unknown op" }, { status: 400 });
}
