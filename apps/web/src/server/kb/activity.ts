import { desc, eq } from "drizzle-orm";
import { db } from "@/server/db";
import { activityEvents, users } from "@/server/db/schema";

export type LogInput = {
  orgId: string;
  actorId?: string | null;
  verb: string;
  objectKind: string;
  title: string;
  linkUrl?: string | null;
};

/**
 * Record an activity event. Best-effort — a logging failure must never break
 * the action that triggered it, so errors are swallowed.
 */
export async function logActivity(input: LogInput): Promise<void> {
  try {
    await db.insert(activityEvents).values({
      orgId: input.orgId,
      actorId: input.actorId ?? null,
      verb: input.verb,
      objectKind: input.objectKind,
      title: input.title,
      linkUrl: input.linkUrl ?? null,
    });
  } catch {
    /* best-effort */
  }
}

function timeAgo(d: Date): string {
  const s = Math.max(1, Math.floor((Date.now() - d.getTime()) / 1000));
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  if (days === 1) return "yesterday";
  if (days < 30) return `${days}d ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export type ActivityRow = {
  id: string;
  who: string;
  verb: string;
  objectKind: string;
  title: string;
  linkUrl: string | null;
  whenLabel: string;
};

export async function listActivity(
  orgId: string,
  limit = 50,
): Promise<ActivityRow[]> {
  const rows = await db
    .select({
      id: activityEvents.id,
      who: users.name,
      email: users.email,
      verb: activityEvents.verb,
      objectKind: activityEvents.objectKind,
      title: activityEvents.title,
      linkUrl: activityEvents.linkUrl,
      createdAt: activityEvents.createdAt,
    })
    .from(activityEvents)
    .leftJoin(users, eq(activityEvents.actorId, users.id))
    .where(eq(activityEvents.orgId, orgId))
    .orderBy(desc(activityEvents.createdAt))
    .limit(limit);

  return rows.map((r) => ({
    id: r.id,
    who: r.who ?? r.email ?? "Someone",
    verb: r.verb,
    objectKind: r.objectKind,
    title: r.title,
    linkUrl: r.linkUrl,
    whenLabel: timeAgo(r.createdAt),
  }));
}
