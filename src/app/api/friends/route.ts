import { db } from "@/db";
import { users, friendships } from "@/db/schema";
import { eq, or } from "drizzle-orm";
import { getUserByToken } from "@/lib/auth";

export const dynamic = "force-dynamic";

// GET: list friends, incoming requests, outgoing requests
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token");
  const u = await getUserByToken(token);
  if (!u) return Response.json({ error: "Not authenticated" }, { status: 401 });

  const rels = await db
    .select()
    .from(friendships)
    .where(or(eq(friendships.requesterId, u.id), eq(friendships.addresseeId, u.id)));

  const otherIds = new Set<number>();
  rels.forEach((r) => {
    otherIds.add(r.requesterId === u.id ? r.addresseeId : r.requesterId);
  });
  const allUsers = otherIds.size
    ? await db.select().from(users)
    : [];
  const nameOf = (id: number) => allUsers.find((x) => x.id === id);

  const friends: { relId: number; id: number; username: string; avatar: string }[] = [];
  const incoming: { relId: number; id: number; username: string; avatar: string }[] = [];
  const outgoing: { relId: number; id: number; username: string; avatar: string }[] = [];

  for (const r of rels) {
    const otherId = r.requesterId === u.id ? r.addresseeId : r.requesterId;
    const other = nameOf(otherId);
    if (!other) continue;
    const entry = { id: other.id, username: other.username, avatar: other.avatar };
    if (r.status === "accepted") {
      friends.push({ relId: r.id, ...entry });
    } else if (r.status === "pending") {
      if (r.addresseeId === u.id) incoming.push({ relId: r.id, ...entry });
      else outgoing.push({ relId: r.id, ...entry });
    }
  }

  return Response.json({ friends, incoming, outgoing });
}

// POST: search users by username
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const token = body?.token as string;
  const query = (body?.query as string)?.trim().toLowerCase();
  const u = await getUserByToken(token);
  if (!u) return Response.json({ error: "Not authenticated" }, { status: 401 });
  if (!query) return Response.json({ results: [] });
  const myId = u.id;

  const all = await db.select().from(users);
  const rels = await db
    .select()
    .from(friendships)
    .where(or(eq(friendships.requesterId, myId), eq(friendships.addresseeId, myId)));

  function relStatus(otherId: number): string {
    const r = rels.find(
      (x) =>
        (x.requesterId === myId && x.addresseeId === otherId) ||
        (x.addresseeId === myId && x.requesterId === otherId)
    );
    if (!r) return "none";
    if (r.status === "accepted") return "friends";
    return r.requesterId === myId ? "outgoing" : "incoming";
  }

  const results = all
    .filter(
      (x) =>
        x.id !== myId &&
        !x.isAdmin &&
        x.approved &&
        x.username.toLowerCase().includes(query)
    )
    .slice(0, 15)
    .map((x) => ({
      id: x.id,
      username: x.username,
      avatar: x.avatar,
      status: relStatus(x.id),
    }));

  return Response.json({ results });
}
