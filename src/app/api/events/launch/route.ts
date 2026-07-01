import { getLaunchEvents } from "@/lib/content";

export const dynamic = "force-dynamic";

export async function GET() {
  const events = await getLaunchEvents();
  return Response.json({ events });
}
