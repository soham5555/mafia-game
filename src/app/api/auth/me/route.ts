import { db } from "@/db";
import { users, players, rooms } from "@/db/schema";
import { and, eq, ne, inArray } from "drizzle-orm";
import { getUserByToken, banInfo } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token");
  const u = await getUserByToken(token);
  if (!u) return Response.json({ error: "Not authenticated" }, { status: 401 });

  // Active game (player row in a room that hasn't ended and not left).
  let activeGame: { code: string; roomToken: string } | null = null;
  const myPlayers = await db
    .select()
    .from(players)
    .where(and(eq(players.userId, u.id), eq(players.leftGame, false)));
  if (myPlayers.length > 0) {
    const roomIds = myPlayers.map((p) => p.roomId);
    const activeRooms = await db
      .select()
      .from(rooms)
      .where(and(inArray(rooms.id, roomIds), ne(rooms.status, "ended")));
    if (activeRooms.length > 0) {
      const room = activeRooms[0];
      const pl = myPlayers.find((p) => p.roomId === room.id);
      if (pl) activeGame = { code: room.code, roomToken: pl.token };
    }
  }

  let pending: { id: number; username: string }[] = [];
  let members: {
    id: number;
    username: string;
    approved: boolean;
    coins: number;
    banned: boolean;
    bannedUntil: string | null;
    avatar: string;
  }[] = [];
  if (u.isAdmin) {
    const all = await db.select().from(users);
    pending = all
      .filter((x) => !x.approved && !x.isAdmin)
      .map((x) => ({ id: x.id, username: x.username }));
    members = all
      .filter((x) => !x.isAdmin)
      .map((x) => ({
        id: x.id,
        username: x.username,
        approved: x.approved,
        coins: x.coins,
        banned: x.banned,
        bannedUntil: x.bannedUntil ? x.bannedUntil.toISOString() : null,
        avatar: x.avatar,
      }));
  }

  return Response.json({
    user: {
      username: u.username,
      coins: u.coins,
      approved: u.approved,
      isAdmin: u.isAdmin,
      inventory: u.inventory ?? {},
      avatar: u.avatar,
      ownedAvatars: u.ownedAvatars ?? [],
      profilePublic: u.profilePublic,
      ban: banInfo(u),
    },
    activeGame,
    pending,
    members,
  });
}
