import { getTexts } from "@/lib/content";

export const dynamic = "force-dynamic";

export async function GET() {
  const texts = await getTexts();
  return Response.json({ texts });
}
