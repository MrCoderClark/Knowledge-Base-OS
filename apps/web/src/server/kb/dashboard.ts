import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/server/db";
import {
  categories,
  courses,
  documents,
  memberships,
  users,
  videos,
} from "@/server/db/schema";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/** Compact relative label ("2h ago", "yesterday"). Computed server-side. */
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
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export type DashboardStats = {
  documents: number;
  videos: number;
  courses: number;
  activeUsers: number;
  docsThisWeek: number;
  videosThisWeek: number;
};

/** Org-scoped counts for the dashboard stat cards. */
export async function dashboardStats(orgId: string): Promise<DashboardStats> {
  const weekAgo = new Date(Date.now() - WEEK_MS);

  const [docs] = await db
    .select({
      total: sql<number>`count(*)`.mapWith(Number),
      week: sql<number>`count(*) filter (where ${documents.createdAt} >= ${weekAgo})`.mapWith(
        Number,
      ),
    })
    .from(documents)
    .where(eq(documents.orgId, orgId));

  const [vids] = await db
    .select({
      total: sql<number>`count(*)`.mapWith(Number),
      week: sql<number>`count(*) filter (where ${videos.createdAt} >= ${weekAgo})`.mapWith(
        Number,
      ),
    })
    .from(videos)
    .where(eq(videos.orgId, orgId));

  const [crs] = await db
    .select({ total: sql<number>`count(*)`.mapWith(Number) })
    .from(courses)
    .where(eq(courses.orgId, orgId));

  const [members] = await db
    .select({ total: sql<number>`count(*)`.mapWith(Number) })
    .from(memberships)
    .where(
      and(eq(memberships.orgId, orgId), eq(memberships.status, "active")),
    );

  return {
    documents: docs?.total ?? 0,
    videos: vids?.total ?? 0,
    courses: crs?.total ?? 0,
    activeUsers: members?.total ?? 0,
    docsThisWeek: docs?.week ?? 0,
    videosThisWeek: vids?.week ?? 0,
  };
}

export type RecentItem = {
  id: string;
  title: string;
  type: "Document" | "Video";
  categoryName: string | null;
  dateLabel: string;
  href: string;
};

/** Most recently added documents + videos, merged and newest-first. */
export async function recentlyAdded(
  orgId: string,
  limit = 5,
): Promise<RecentItem[]> {
  const [docs, vids] = await Promise.all([
    db
      .select({
        id: documents.id,
        title: documents.title,
        categoryName: categories.name,
        createdAt: documents.createdAt,
      })
      .from(documents)
      .leftJoin(categories, eq(documents.categoryId, categories.id))
      .where(eq(documents.orgId, orgId))
      .orderBy(desc(documents.createdAt))
      .limit(limit),
    db
      .select({
        id: videos.id,
        title: videos.title,
        categoryName: categories.name,
        createdAt: videos.createdAt,
      })
      .from(videos)
      .leftJoin(categories, eq(videos.categoryId, categories.id))
      .where(eq(videos.orgId, orgId))
      .orderBy(desc(videos.createdAt))
      .limit(limit),
  ]);

  const merged = [
    ...docs.map((d) => ({ ...d, type: "Document" as const })),
    ...vids.map((v) => ({ ...v, type: "Video" as const })),
  ];
  return merged
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, limit)
    .map((r) => ({
      id: r.id,
      title: r.title,
      type: r.type,
      categoryName: r.categoryName,
      dateLabel: timeAgo(r.createdAt),
      href: r.type === "Document" ? `/documents/${r.id}` : `/videos/${r.id}`,
    }));
}

export type ActivityItem = {
  who: string;
  verb: string;
  target: string;
  whenLabel: string;
  href: string;
};

/**
 * Derived activity feed from the most recent content additions (no dedicated
 * activity_events table yet — this is real, if coarse, activity).
 */
export async function recentActivity(
  orgId: string,
  limit = 6,
): Promise<ActivityItem[]> {
  const [docs, vids, crs] = await Promise.all([
    db
      .select({
        title: documents.title,
        id: documents.id,
        createdAt: documents.createdAt,
        who: users.name,
      })
      .from(documents)
      .leftJoin(users, eq(documents.createdBy, users.id))
      .where(eq(documents.orgId, orgId))
      .orderBy(desc(documents.createdAt))
      .limit(limit),
    db
      .select({
        title: videos.title,
        id: videos.id,
        createdAt: videos.createdAt,
        who: users.name,
      })
      .from(videos)
      .leftJoin(users, eq(videos.createdBy, users.id))
      .where(eq(videos.orgId, orgId))
      .orderBy(desc(videos.createdAt))
      .limit(limit),
    db
      .select({
        title: courses.title,
        id: courses.id,
        createdAt: courses.createdAt,
        who: users.name,
      })
      .from(courses)
      .leftJoin(users, eq(courses.createdBy, users.id))
      .where(eq(courses.orgId, orgId))
      .orderBy(desc(courses.createdAt))
      .limit(limit),
  ]);

  const items = [
    ...docs.map((d) => ({
      who: d.who ?? "Someone",
      verb: "added the document",
      target: d.title,
      createdAt: d.createdAt,
      href: `/documents/${d.id}`,
    })),
    ...vids.map((v) => ({
      who: v.who ?? "Someone",
      verb: "uploaded the video",
      target: v.title,
      createdAt: v.createdAt,
      href: `/videos/${v.id}`,
    })),
    ...crs.map((c) => ({
      who: c.who ?? "Someone",
      verb: "created the course",
      target: c.title,
      createdAt: c.createdAt,
      href: `/courses/${c.id}`,
    })),
  ];
  return items
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, limit)
    .map((i) => ({
      who: i.who,
      verb: i.verb,
      target: i.target,
      whenLabel: timeAgo(i.createdAt),
      href: i.href,
    }));
}
