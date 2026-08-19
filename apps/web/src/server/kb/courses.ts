import { and, asc, desc, eq, sql } from "drizzle-orm";
import { db } from "@/server/db";
import {
  categories,
  courseLessons,
  courses,
  lessonCompletions,
  videos,
} from "@/server/db/schema";
import { slugify } from "./categories";

export type Course = typeof courses.$inferSelect;

async function uniqueSlug(orgId: string, title: string): Promise<string> {
  const base = slugify(title);
  let slug = base;
  let n = 1;
  for (;;) {
    const [existing] = await db
      .select({ id: courses.id })
      .from(courses)
      .where(and(eq(courses.orgId, orgId), eq(courses.slug, slug)));
    if (!existing) return slug;
    slug = `${base}-${++n}`;
  }
}

export function listCourses(
  orgId: string,
  opts?: { includeUnpublished?: boolean },
) {
  const conds = [eq(courses.orgId, orgId)];
  if (!opts?.includeUnpublished) conds.push(eq(courses.status, "published"));
  return db
    .select({
      id: courses.id,
      title: courses.title,
      description: courses.description,
      status: courses.status,
      categoryName: categories.name,
      categoryColor: categories.color,
      lessonCount: sql<number>`(select count(*) from course_lessons where course_lessons.course_id = ${courses.id})`.mapWith(
        Number,
      ),
      updatedAt: courses.updatedAt,
    })
    .from(courses)
    .leftJoin(categories, eq(courses.categoryId, categories.id))
    .where(and(...conds))
    .orderBy(desc(courses.updatedAt));
}

export async function getCourse(orgId: string, id: string) {
  const [row] = await db
    .select()
    .from(courses)
    .where(and(eq(courses.id, id), eq(courses.orgId, orgId)));
  return row ?? null;
}

/** Ordered lessons with the underlying video's display info. */
export function getCourseLessons(courseId: string) {
  return db
    .select({
      id: courseLessons.id,
      position: courseLessons.position,
      itemType: courseLessons.itemType,
      itemId: courseLessons.itemId,
      overrideTitle: courseLessons.title,
      videoTitle: videos.title,
      videoDuration: videos.durationSeconds,
      videoStatus: videos.status,
    })
    .from(courseLessons)
    .leftJoin(videos, eq(courseLessons.itemId, videos.id))
    .where(eq(courseLessons.courseId, courseId))
    .orderBy(asc(courseLessons.position));
}

export async function createCourse(params: {
  orgId: string;
  title: string;
  description: string | null;
  categoryId: string | null;
  createdBy: string;
}): Promise<string> {
  const slug = await uniqueSlug(params.orgId, params.title);
  const [row] = await db
    .insert(courses)
    .values({
      orgId: params.orgId,
      title: params.title.trim(),
      slug,
      description: params.description,
      categoryId: params.categoryId,
      status: "draft",
      createdBy: params.createdBy,
      updatedBy: params.createdBy,
    })
    .returning({ id: courses.id });
  return row.id;
}

export async function updateCourse(params: {
  orgId: string;
  id: string;
  title: string;
  description: string | null;
  categoryId: string | null;
  updatedBy: string;
}): Promise<void> {
  await db
    .update(courses)
    .set({
      title: params.title.trim(),
      description: params.description,
      categoryId: params.categoryId,
      updatedBy: params.updatedBy,
      updatedAt: new Date(),
    })
    .where(and(eq(courses.id, params.id), eq(courses.orgId, params.orgId)));
}

export async function setCourseStatus(params: {
  orgId: string;
  id: string;
  status: "draft" | "published" | "archived";
}): Promise<void> {
  await db
    .update(courses)
    .set({ status: params.status, updatedAt: new Date() })
    .where(and(eq(courses.id, params.id), eq(courses.orgId, params.orgId)));
}

export async function deleteCourse(params: {
  orgId: string;
  id: string;
}): Promise<void> {
  await db
    .delete(courses)
    .where(and(eq(courses.id, params.id), eq(courses.orgId, params.orgId)));
}

/* --- Lessons --- */

export async function addVideoLesson(
  courseId: string,
  videoId: string,
): Promise<void> {
  const [{ maxPos }] = await db
    .select({ maxPos: sql<number>`coalesce(max(${courseLessons.position}), 0)` })
    .from(courseLessons)
    .where(eq(courseLessons.courseId, courseId));
  await db.insert(courseLessons).values({
    courseId,
    position: (maxPos ?? 0) + 1,
    itemType: "video",
    itemId: videoId,
  });
}

export async function removeLesson(
  courseId: string,
  lessonId: string,
): Promise<void> {
  await db
    .delete(courseLessons)
    .where(
      and(eq(courseLessons.id, lessonId), eq(courseLessons.courseId, courseId)),
    );
}

export async function reorderLessons(
  courseId: string,
  orderedLessonIds: string[],
): Promise<void> {
  for (let i = 0; i < orderedLessonIds.length; i++) {
    await db
      .update(courseLessons)
      .set({ position: i + 1 })
      .where(
        and(
          eq(courseLessons.id, orderedLessonIds[i]),
          eq(courseLessons.courseId, courseId),
        ),
      );
  }
}

/* --- Completion / progress --- */

export async function markLessonComplete(
  userId: string,
  courseLessonId: string,
): Promise<void> {
  await db
    .insert(lessonCompletions)
    .values({ userId, courseLessonId })
    .onConflictDoNothing();
}

/** Set of completed lesson ids for a user within a course. */
export async function completedLessonIds(
  userId: string,
  courseId: string,
): Promise<string[]> {
  const rows = await db
    .select({ id: lessonCompletions.courseLessonId })
    .from(lessonCompletions)
    .innerJoin(
      courseLessons,
      eq(lessonCompletions.courseLessonId, courseLessons.id),
    )
    .where(
      and(
        eq(lessonCompletions.userId, userId),
        eq(courseLessons.courseId, courseId),
      ),
    );
  return rows.map((r) => r.id);
}
