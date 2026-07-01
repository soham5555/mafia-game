import {
  pgTable,
  serial,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  token: text("token"), // active session token
  coins: integer("coins").notNull().default(500),
  approved: boolean("approved").notNull().default(false),
  isAdmin: boolean("is_admin").notNull().default(false),
  avatar: text("avatar").notNull().default("🕵️"),
  ownedAvatars: jsonb("owned_avatars").$type<string[]>().default([]),
  inventory: jsonb("inventory").$type<Record<string, number>>().default({}),
  banned: boolean("banned").notNull().default(false),
  bannedUntil: timestamp("banned_until"), // null = permanent while banned=true
  banReason: text("ban_reason"),
  profilePublic: boolean("profile_public").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Who visited whose profile.
export const profileVisits = pgTable("profile_visits", {
  id: serial("id").primaryKey(),
  profileUserId: integer("profile_user_id").notNull(),
  visitorUserId: integer("visitor_user_id").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Admin-added custom shop items + overrides for built-in items.
// itemKey matches a built-in key (for overrides) or is brand new (custom item).
export const shopItems = pgTable("shop_items", {
  id: serial("id").primaryKey(),
  itemKey: text("item_key").notNull().unique(),
  name: text("name").notNull(),
  emoji: text("emoji").notNull().default("🎁"),
  description: text("description").notNull().default(""),
  price: integer("price").notNull().default(100),
  kind: text("kind").notNull().default("item"), // item | avatar
  custom: boolean("custom").notNull().default(true), // true = admin-created
  disabledUntil: timestamp("disabled_until"), // temporarily hidden until this time
  discountPercent: integer("discount_percent").notNull().default(0),
  discountName: text("discount_name"),
  discountStartsAt: timestamp("discount_starts_at"), // sale becomes active at this time
  discountUntil: timestamp("discount_until"), // sale ends at this time
  discountSurprise: boolean("discount_surprise").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Admin-added custom roles injected into the role pool.
export const customRoles = pgTable("custom_roles", {
  id: serial("id").primaryKey(),
  roleKey: text("role_key").notNull().unique(),
  name: text("name").notNull(),
  emoji: text("emoji").notNull().default("❓"),
  team: text("team").notNull().default("town"), // town | mafia | neutral
  description: text("description").notNull().default(""),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Editable site text (key -> value), managed by admin.
export const siteText = pgTable("site_text", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Admin-uploaded custom avatars (image stored as a data URL).
export const customAvatars = pgTable("custom_avatars", {
  id: serial("id").primaryKey(),
  avatarKey: text("avatar_key").notNull().unique(), // e.g. cav_abc123
  name: text("name").notNull(),
  image: text("image").notNull(), // data URL (JPEG/PNG, resized client-side)
  price: integer("price").notNull().default(300),
  discountPercent: integer("discount_percent").notNull().default(0),
  discountName: text("discount_name"),
  discountStartsAt: timestamp("discount_starts_at"),
  discountUntil: timestamp("discount_until"),
  discountSurprise: boolean("discount_surprise").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Friendships: one row per relationship. status = pending | accepted
export const friendships = pgTable("friendships", {
  id: serial("id").primaryKey(),
  requesterId: integer("requester_id").notNull(),
  addresseeId: integer("addressee_id").notNull(),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Notifications: per-user feed (deductions, purchases, friend requests, invites)
export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  type: text("type").notNull(), // coins | purchase | sale | friend | invite | info
  text: text("text").notNull(),
  meta: jsonb("meta").$type<Record<string, unknown>>().default({}),
  read: boolean("read").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const rooms = pgTable("rooms", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  status: text("status").notNull().default("lobby"), // lobby | night | day | ended
  dayNumber: integer("day_number").notNull().default(0),
  winner: text("winner"), // town | mafia | neutral name | null
  phaseSeconds: integer("phase_seconds").notNull().default(0), // 0 = manual, else auto timer
  phaseEndsAt: timestamp("phase_ends_at"),
  isPublic: boolean("is_public").notNull().default(false),
  hostName: text("host_name").notNull().default(""),
  settings: jsonb("settings").$type<Record<string, unknown>>().default({}),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Per-player match results for history + win/lose stats.
export const matchHistory = pgTable("match_history", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  roomCode: text("room_code").notNull(),
  role: text("role"),
  team: text("team"),
  result: text("result").notNull(), // win | lose
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const players = pgTable("players", {
  id: serial("id").primaryKey(),
  roomId: integer("room_id").notNull(),
  userId: integer("user_id"),
  token: text("token").notNull(),
  name: text("name").notNull(),
  seat: integer("seat").notNull().default(0),
  isHost: boolean("is_host").notNull().default(false),
  role: text("role"), // role key
  team: text("team"), // town | mafia | neutral
  alive: boolean("alive").notNull().default(true),
  extraLives: integer("extra_lives").notNull().default(0),
  state: jsonb("state").$type<Record<string, unknown>>().default({}),
  lastSeenAt: timestamp("last_seen_at").notNull().defaultNow(),
  leftGame: boolean("left_game").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const events = pgTable("events", {
  id: serial("id").primaryKey(),
  roomId: integer("room_id").notNull(),
  type: text("type").notNull(), // gunshot | investigate | heal | block | etc.
  audience: jsonb("audience").$type<number[] | "all">(),
  meta: jsonb("meta").$type<Record<string, unknown>>().default({}),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const actions = pgTable("actions", {
  id: serial("id").primaryKey(),
  roomId: integer("room_id").notNull(),
  dayNumber: integer("day_number").notNull(),
  actorId: integer("actor_id").notNull(),
  targetId: integer("target_id"),
  actionType: text("action_type").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const votes = pgTable("votes", {
  id: serial("id").primaryKey(),
  roomId: integer("room_id").notNull(),
  dayNumber: integer("day_number").notNull(),
  voterId: integer("voter_id").notNull(),
  targetId: integer("target_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  roomId: integer("room_id").notNull(),
  channel: text("channel").notNull().default("day"), // day | mafia | dead | system
  senderId: integer("sender_id"),
  senderName: text("sender_name").notNull(),
  text: text("text").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const logs = pgTable("logs", {
  id: serial("id").primaryKey(),
  roomId: integer("room_id").notNull(),
  dayNumber: integer("day_number").notNull(),
  text: text("text").notNull(),
  audience: jsonb("audience").$type<number[] | "all">(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
