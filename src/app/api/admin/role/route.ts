import { db } from "@/db";
import { customRoles } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireAdmin } from "@/lib/admin";
import { ROLES } from "@/lib/roles";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const admin = await requireAdmin(searchParams.get("token"));
  if (!admin) return Response.json({ error: "Admin only" }, { status: 403 });
  const roles = await db.select().from(customRoles);
  return Response.json({ roles });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const admin = await requireAdmin(body?.authToken ?? body?.token);
  if (!admin) return Response.json({ error: "Admin only" }, { status: 403 });

  const op = body?.op as string;

  if (op === "delete") {
    await db.delete(customRoles).where(eq(customRoles.roleKey, body?.roleKey as string));
    return Response.json({ ok: true });
  }

  if (op === "create") {
    const name = (body?.name as string)?.trim();
    if (!name) return Response.json({ error: "Name required" }, { status: 400 });
    const team = (body?.team as string) || "town";
    if (!["town", "mafia", "neutral"].includes(team))
      return Response.json({ error: "Invalid team" }, { status: 400 });
    const roleKey = "custom_" + name.toLowerCase().replace(/[^a-z0-9]+/g, "_").slice(0, 20);
    if (ROLES[roleKey])
      return Response.json({ error: "Reserved key" }, { status: 400 });
    const exists = await db.select().from(customRoles).where(eq(customRoles.roleKey, roleKey));
    if (exists.length > 0) return Response.json({ error: "Role already exists" }, { status: 400 });
    await db.insert(customRoles).values({
      roleKey,
      name,
      emoji: (body?.emoji as string) || "❓",
      team,
      description: (body?.description as string) || "",
      active: true,
    });
    return Response.json({ ok: true });
  }

  return Response.json({ error: "Unknown op" }, { status: 400 });
}
