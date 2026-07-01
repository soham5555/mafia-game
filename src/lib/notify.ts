import { db } from "@/db";
import { notifications } from "@/db/schema";

export async function notify(
  userId: number,
  type: string,
  text: string,
  meta: Record<string, unknown> = {}
) {
  await db.insert(notifications).values({ userId, type, text, meta });
}
