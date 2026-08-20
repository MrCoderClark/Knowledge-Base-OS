import { and, eq, sql } from "drizzle-orm";
import { db } from "@/server/db";
import { enrollments, userBadges } from "@/server/db/schema";

export type BadgeDef = {
  key: string;
  name: string;
  description: string;
  icon: string; // emoji
  points: number;
};

/** System badge catalog (code-defined; only awards are stored). */
export const BADGES: Record<string, BadgeDef> = {
  "first-course": {
    key: "first-course",
    name: "First Steps",
    description: "Completed your first course.",
    icon: "🌱",
    points: 50,
  },
  "three-courses": {
    key: "three-courses",
    name: "Getting Rolling",
    description: "Completed 3 courses.",
    icon: "🚀",
    points: 100,
  },
  "five-courses": {
    key: "five-courses",
    name: "Dedicated Learner",
    description: "Completed 5 courses.",
    icon: "📚",
    points: 150,
  },
  "ten-courses": {
    key: "ten-courses",
    name: "Knowledge Seeker",
    description: "Completed 10 courses.",
    icon: "🏆",
    points: 300,
  },
  "perfect-quiz": {
    key: "perfect-quiz",
    name: "Perfect Score",
    description: "Scored 100% on a quiz.",
    icon: "🎯",
    points: 75,
  },
};

const COURSE_MILESTONES: { count: number; key: string }[] = [
  { count: 1, key: "first-course" },
  { count: 3, key: "three-courses" },
  { count: 5, key: "five-courses" },
  { count: 10, key: "ten-courses" },
];

const RANKS: { min: number; name: string }[] = [
  { min: 1000, name: "Expert" },
  { min: 600, name: "Adventurer" },
  { min: 300, name: "Ranger" },
  { min: 100, name: "Explorer" },
  { min: 0, name: "Scout" },
];

export function rankFor(points: number): string {
  return RANKS.find((r) => points >= r.min)?.name ?? "Scout";
}

/** Award a badge if not already held. Returns true only on a new award. */
async function award(
  orgId: string,
  userId: string,
  badgeKey: string,
): Promise<boolean> {
  const rows = await db
    .insert(userBadges)
    .values({ orgId, userId, badgeKey })
    .onConflictDoNothing({ target: [userBadges.userId, userBadges.badgeKey] })
    .returning({ id: userBadges.id });
  return rows.length > 0;
}

/** Award course-completion milestone badges. Returns newly earned defs. */
export async function awardCourseBadges(
  orgId: string,
  userId: string,
): Promise<BadgeDef[]> {
  const [{ done }] = await db
    .select({ done: sql<number>`count(*)`.mapWith(Number) })
    .from(enrollments)
    .where(
      and(
        eq(enrollments.orgId, orgId),
        eq(enrollments.userId, userId),
        eq(enrollments.status, "completed"),
      ),
    );

  const newly: BadgeDef[] = [];
  for (const m of COURSE_MILESTONES) {
    if (done >= m.count && (await award(orgId, userId, m.key))) {
      newly.push(BADGES[m.key]);
    }
  }
  return newly;
}

/** Award a one-off badge by key (e.g. perfect-quiz). Returns the def if new. */
export async function awardBadge(
  orgId: string,
  userId: string,
  badgeKey: string,
): Promise<BadgeDef | null> {
  if (!BADGES[badgeKey]) return null;
  return (await award(orgId, userId, badgeKey)) ? BADGES[badgeKey] : null;
}

export type EarnedBadge = BadgeDef & { earnedAt: Date };

export async function listUserBadges(userId: string): Promise<EarnedBadge[]> {
  const rows = await db
    .select({ badgeKey: userBadges.badgeKey, earnedAt: userBadges.earnedAt })
    .from(userBadges)
    .where(eq(userBadges.userId, userId));
  return rows
    .map((r) => {
      const def = BADGES[r.badgeKey];
      return def ? { ...def, earnedAt: r.earnedAt } : null;
    })
    .filter((b): b is EarnedBadge => b !== null)
    .sort((a, b) => b.earnedAt.getTime() - a.earnedAt.getTime());
}

export async function userPoints(userId: string): Promise<number> {
  const badges = await listUserBadges(userId);
  return badges.reduce((sum, b) => sum + b.points, 0);
}
