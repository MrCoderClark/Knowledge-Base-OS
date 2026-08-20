import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/server/db";
import { notifications } from "@/server/db/schema";

export type NotificationType =
  | "course_assigned"
  | "course_completed"
  | "course_due_soon"
  | "badge_earned";

export type NewNotification = {
  orgId: string;
  userId: string;
  type: NotificationType;
  title: string;
  body?: string | null;
  linkUrl?: string | null;
};

export async function createNotification(n: NewNotification): Promise<void> {
  await db.insert(notifications).values({
    orgId: n.orgId,
    userId: n.userId,
    type: n.type,
    title: n.title,
    body: n.body ?? null,
    linkUrl: n.linkUrl ?? null,
  });
}

/** Insert one notification per row (e.g. bulk course assignment). */
export async function notifyMany(rows: NewNotification[]): Promise<void> {
  if (rows.length === 0) return;
  await db.insert(notifications).values(
    rows.map((n) => ({
      orgId: n.orgId,
      userId: n.userId,
      type: n.type,
      title: n.title,
      body: n.body ?? null,
      linkUrl: n.linkUrl ?? null,
    })),
  );
}

export type NotificationRow = typeof notifications.$inferSelect;

export function listNotifications(
  userId: string,
  limit = 15,
): Promise<NotificationRow[]> {
  return db
    .select()
    .from(notifications)
    .where(eq(notifications.userId, userId))
    .orderBy(desc(notifications.createdAt))
    .limit(limit);
}

export async function unreadCount(userId: string): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)`.mapWith(Number) })
    .from(notifications)
    .where(
      and(eq(notifications.userId, userId), isNull(notifications.readAt)),
    );
  return row?.n ?? 0;
}

export async function markAllRead(userId: string): Promise<void> {
  await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(
      and(eq(notifications.userId, userId), isNull(notifications.readAt)),
    );
}

export async function markRead(id: string, userId: string): Promise<void> {
  await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(
      and(eq(notifications.id, id), eq(notifications.userId, userId)),
    );
}
