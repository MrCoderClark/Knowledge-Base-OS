import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/server/db";
import { learningProgress } from "@/server/db/schema";
import { completedLessonIds, getCourseLessons } from "./courses";
import { listEnrolledCourses } from "./enrollments";

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
 * (not yet completed) courses, each pointing at the next incomplete lesson,
 * ordered by most-recent activity.
 */
export async function continueLearning(
  orgId: string,
  userId: string,
): Promise<ContinueLearningCard[]> {
  const enrolled = await listEnrolledCourses(orgId, userId);

  const cards: ContinueLearningCard[] = [];
  for (const course of enrolled) {
    const lessons = await getCourseLessons(course.id);
    if (lessons.length === 0) continue;

    const completed = new Set(await completedLessonIds(userId, course.id));
    const doneCount = lessons.filter((l) => completed.has(l.id)).length;
    if (doneCount === lessons.length) continue; // finished — not "continue"

    const next =
      lessons.find((l) => !completed.has(l.id)) ?? lessons[lessons.length - 1];
    const prog = next.itemId
      ? await getVideoProgress(userId, next.itemId)
      : null;

    cards.push({
      courseId: course.id,
      title: course.title,
      subtitle: next.overrideTitle ?? next.videoTitle ?? "Lesson",
      coursePct: Math.round((doneCount / lessons.length) * 100),
      resumeLessonId: next.id,
      lastActivity: prog?.updatedAt ?? course.enrolledAt,
    });
  }

  return cards.sort(
    (a, b) => b.lastActivity.getTime() - a.lastActivity.getTime(),
  );
}
