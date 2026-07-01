import { requireAdmin } from "@/lib/admin";
import { getTexts, setText, DEFAULT_TEXTS } from "@/lib/content";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const admin = await requireAdmin(searchParams.get("token"));
  if (!admin) return Response.json({ error: "Admin only" }, { status: 403 });
  const texts = await getTexts();
  return Response.json({ texts, keys: Object.keys(DEFAULT_TEXTS) });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const admin = await requireAdmin(body?.authToken ?? body?.token);
  if (!admin) return Response.json({ error: "Admin only" }, { status: 403 });
  const updates = body?.texts as Record<string, string>;
  if (!updates || typeof updates !== "object")
    return Response.json({ error: "No texts" }, { status: 400 });
  for (const [k, v] of Object.entries(updates)) {
    if (typeof v === "string") await setText(k, v.slice(0, 500));
  }
  return Response.json({ ok: true });
}
