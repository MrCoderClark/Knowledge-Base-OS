import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/server/db";
import { learningProgress } from "@/server/db/schema";
import { getCertificateCode } from "./certificates";
import { completedLessonIds, getCourseLessons } from "./courses";
import { listEnrollmentsWithCourse } from "./enrollments";

export type VideoProgress = {
  lastPositionSeconds: number;
  progressPct: number;
  updatedAt: Date;
};

/**
 * Record where a learner is in a video. Position is the resume point (latest),
 * while pct is kept monotonic (max ever reached) so a completed video stays
 * complete even if the learner re-watches from the start.
 */
export async function upsertVideoProgress(params: {
  orgId: string;
  userId: string;
  videoId: string;
  positionSeconds: number;
  durationSeconds: number;
}): Promise<void> {
  const position = Math.max(0, Math.floor(params.positionSeconds));
  const pct =
    params.durationSeconds > 0
      ? Math.min(100, Math.round((position / params.durationSeconds) * 100))
      : 0;

  await db
    .insert(learningProgress)
    .values({
      orgId: params.orgId,
      userId: params.userId,
      itemType: "video",
      itemId: params.videoId,
      progressPct: pct,
      lastPositionSeconds: position,
    })
    .onConflictDoUpdate({
      target: [
        learningProgress.userId,
        learningProgress.itemType,
        learningProgress.itemId,
      ],
      set: {
        lastPositionSeconds: position,
        progressPct: sql`greatest(${learningProgress.progressPct}, ${pct})`,
        updatedAt: new Date(),
      },
    });
}

export async function getVideoProgress(
  userId: string,
  videoId: string,
): Promise<VideoProgress | null> {
  const [row] = await db
    .select({
      lastPositionSeconds: learningProgress.lastPositionSeconds,
      progressPct: learningProgress.progressPct,
      updatedAt: learningProgress.updatedAt,
    })
    .from(learningProgress)
    .where(
      and(
        eq(learningProgress.userId, userId),
        eq(learningProgress.itemType, "video"),
        eq(learningProgress.itemId, videoId),
      ),
    );
  return row ?? null;
}

/** Progress for several videos at once (viewer sidebar) → keyed by videoId. */
export async function getVideoProgressMap(
  userId: string,
  videoIds: string[],
): Promise<Map<string, VideoProgress>> {
  const map = new Map<string, VideoProgress>();
  if (videoIds.length === 0) return map;
  const rows = await db
    .select({
      itemId: learningProgress.itemId,
      lastPositionSeconds: learningProgress.lastPositionSeconds,
      progressPct: learningProgress.progressPct,
      updatedAt: learningProgress.updatedAt,
    })
    .from(learningProgress)
    .where(
      and(
        eq(learningProgress.userId, userId),
        eq(learningProgress.itemType, "video"),
        inArray(learningProgress.itemId, videoIds),
      ),
    );
  for (const r of rows) {
    map.set(r.itemId, {
      lastPositionSeconds: r.lastPositionSeconds,
      progressPct: r.progressPct,
      updatedAt: r.updatedAt,
    });
  }
  return map;
}

export type MyCourseCard = {
  courseId: string;
  title: string;
  status: "enrolled" | "completed";
  /** True when an admin assigned this (vs. self-enrolled). */
  assigned: boolean;
  dueAt: Date | null;
  /** Blended progress: completed lessons + partial watch credit. */
  coursePct: number;
  /** True once any lesson has been watched (even partially) or completed. */
  started: boolean;
  doneLessons: number;
  totalLessons: number;
  resumeLessonId: string | null;
  /** Title of the next lesson to resume (null when finished/empty). */
  nextLessonTitle: string | null;
  /** Verification code once the course is completed (else null). */
  certificateCode: string | null;
  lastActivity: Date;
};

/**
 * Every course a learner is enrolled in, with computed progress + the next
 * lesson to resume. Powers the "My Learning" hub and Continue-Learning rail.
 * Progress is blended: completed lessons count fully, partially-watched ones
 * get proportional credit, so a course reads as "in progress" the moment a
 * learner starts watching — before any single lesson is finished.
 */
export async function myCourses(
  orgId: string,
  userId: string,
): Promise<MyCourseCard[]> {
  const rows = await listEnrollmentsWithCourse(orgId, userId);

  const cards: MyCourseCard[] = [];
  for (const e of rows) {
    const lessons = await getCourseLessons(e.courseId);
    const total = lessons.length;
    const completed = new Set(await completedLessonIds(userId, e.courseId));
    const done = lessons.filter((l) => completed.has(l.id)).length;
    const progress = await getVideoProgressMap(
      userId,
      lessons.map((l) => l.itemId),
    );

    let fractionSum = 0;
    let anyWatched = false;
    for (const l of lessons) {
      if (completed.has(l.id)) {
        fractionSum += 1;
        continue;
      }
      const pct = progress.get(l.itemId)?.progressPct ?? 0;
      if (pct > 0) anyWatched = true;
      fractionSum += pct / 100;
    }

    const next = lessons.find((l) => !completed.has(l.id)) ?? null;
    const prog = next?.itemId != null ? progress.get(next.itemId) : undefined;
    const certificateCode =
      e.status === "completed"
        ? await getCertificateCode(userId, e.courseId)
        : null;

    cards.push({
      courseId: e.courseId,
      title: e.title,
      status: e.status,
      assigned: e.assignedBy != null,
      dueAt: e.dueAt,
      coursePct: total > 0 ? Math.round((fractionSum / total) * 100) : 0,
      started: done > 0 || anyWatched,
      doneLessons: done,
      totalLessons: total,
      resumeLessonId: next?.id ?? lessons[0]?.id ?? null,
      nextLessonTitle: next
        ? (next.overrideTitle ?? next.videoTitle ?? "Lesson")
        : null,
      certificateCode,
      lastActivity: prog?.updatedAt ?? e.completedAt ?? e.enrolledAt,
    });
  }
  return cards;
}

export type ContinueLearningCard = {
  courseId: string;
  title: string;
  /** Title of the next lesson the learner should resume. */
  subtitle: string;
  coursePct: number;
  resumeLessonId: string;
  lastActivity: Date;
};

/**
 * In-progress *courses* for the dashboard "Continue Learning" rail: enrolled
 * (not yet completed) courses with at least one lesson remaining, ordered by
 * most-recent activity.
 */
export async function continueLearning(
  orgId: string,
  userId: string,
): Promise<ContinueLearningCard[]> {
  const cards = await myCourses(orgId, userId);
  return cards
    .filter(
      (c) =>
        c.status === "enrolled" &&
        c.started &&
        c.totalLessons > 0 &&
        c.coursePct < 100 &&
        c.resumeLessonId != null,
    )
    .sort((a, b) => b.lastActivity.getTime() - a.lastActivity.getTime())
    .map((c) => ({
      courseId: c.courseId,
      title: c.title,
      subtitle: c.nextLessonTitle ?? "Lesson",
      coursePct: c.coursePct,
      resumeLessonId: c.resumeLessonId as string,
      lastActivity: c.lastActivity,
    }));
}
