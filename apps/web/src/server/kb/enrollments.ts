import { and, eq, ne, sql } from "drizzle-orm";
import { db } from "@/server/db";
import {
  courseLessons,
  courses,
  enrollments,
  lessonCompletions,
} from "@/server/db/schema";

/** Enroll a learner in a course if they aren't already (idempotent). */
export async function ensureEnrollment(
  orgId: string,
  courseId: string,
  userId: string,
): Promise<void> {
  await db
    .insert(enrollments)
    .values({ orgId, courseId, userId })
    .onConflictDoNothing({ target: [enrollments.courseId, enrollments.userId] });
}

/**
 * Flip an enrollment to `completed` once every lesson in the course is done.
 * No-op for courses with no lessons or already-completed enrollments.
 */
export async function completeEnrollmentIfDone(
  courseId: string,
  userId: string,
): Promise<boolean> {
  const [{ total }] = await db
    .select({ total: sql<number>`count(*)`.mapWith(Number) })
    .from(courseLessons)
    .where(eq(courseLessons.courseId, courseId));
  if (total === 0) return false;

  const [{ done }] = await db
    .select({ done: sql<number>`count(*)`.mapWith(Number) })
    .from(lessonCompletions)
    .innerJoin(
      courseLessons,
      eq(lessonCompletions.courseLessonId, courseLessons.id),
    )
    .where(
      and(
        eq(courseLessons.courseId, courseId),
        eq(lessonCompletions.userId, userId),
      ),
    );
  if (done < total) return false;

  await db
    .update(enrollments)
    .set({ status: "completed", completedAt: new Date() })
    .where(
      and(
        eq(enrollments.courseId, courseId),
        eq(enrollments.userId, userId),
        ne(enrollments.status, "completed"),
      ),
    );
  return true;
}

export type EnrolledCourse = {
  id: string;
  title: string;
  enrolledAt: Date;
};

/** Courses a learner is actively enrolled in (not yet completed). */
export function listEnrolledCourses(
  orgId: string,
  userId: string,
): Promise<EnrolledCourse[]> {
  return db
    .select({
      id: courses.id,
      title: courses.title,
      enrolledAt: enrollments.enrolledAt,
    })
    .from(enrollments)
    .innerJoin(courses, eq(enrollments.courseId, courses.id))
    .where(
      and(
        eq(enrollments.orgId, orgId),
        eq(enrollments.userId, userId),
        eq(enrollments.status, "enrolled"),
        ne(courses.status, "archived"),
      ),
    );
}

/** Whether a specific learner is enrolled in a course. */
export async function isEnrolled(
  courseId: string,
  userId: string,
): Promise<boolean> {
  const [row] = await db
    .select({ id: enrollments.id })
    .from(enrollments)
    .where(
      and(
        eq(enrollments.courseId, courseId),
        eq(enrollments.userId, userId),
      ),
    );
  return !!row;
}
