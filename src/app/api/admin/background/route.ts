import { requireAdmin } from "@/lib/admin";
import { getTexts, setText } from "@/lib/content";

export const dynamic = "force-dynamic";

// Valid background setting keys
export const BG_KEYS = ["bg_color", "bg_gif_url", "bg_type"] as const;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const admin = await requireAdmin(searchParams.get("token"));
  if (!admin) return Response.json({ error: "Admin only" }, { status: 403 });

  const texts = await getTexts();
  return Response.json({
    bgColor: texts["bg_color"] ?? "",
    bgGifUrl: texts["bg_gif_url"] ?? "",
    bgType: texts["bg_type"] ?? "gradient", // gradient | color | gif
  });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const admin = await requireAdmin(body?.authToken ?? body?.token);
  if (!admin) return Response.json({ error: "Admin only" }, { status: 403 });

  const { bgColor, bgGifUrl, bgType } = body as {
    bgColor?: string;
    bgGifUrl?: string;
    bgType?: string;
  };

  if (bgType !== undefined) {
    const validTypes = ["gradient", "color", "gif"];
    if (!validTypes.includes(bgType))
      return Response.json({ error: "Invalid bg_type" }, { status: 400 });
    await setText("bg_type", bgType);
  }

  if (bgColor !== undefined) {
    // Allow any CSS color string up to 50 chars
    await setText("bg_color", String(bgColor).slice(0, 50));
  }

  if (bgGifUrl !== undefined) {
    // Allow a URL or empty string (to clear)
    await setText("bg_gif_url", String(bgGifUrl).slice(0, 500));
  }

  return Response.json({ ok: true });
}
