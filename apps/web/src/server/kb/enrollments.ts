import { and, eq, inArray, ne, sql } from "drizzle-orm";
import { db } from "@/server/db";
import {
  courseLessons,
  courses,
  enrollments,
  lessonCompletions,
  teamMembers,
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

/** User ids belonging to a team (within the org via the team). */
export async function teamMemberIds(teamId: string): Promise<string[]> {
  const rows = await db
    .select({ userId: teamMembers.userId })
    .from(teamMembers)
    .where(eq(teamMembers.teamId, teamId));
  return rows.map((r) => r.userId);
}

/**
 * Admin assignment — enroll each user, stamping who assigned it, an optional
 * deadline, and the originating team. Re-assigning updates the deadline
 * without disturbing existing progress/completion. Returns the assigned ids.
 */
export async function assignCourse(params: {
  orgId: string;
  courseId: string;
  userIds: string[];
  assignedBy: string;
  dueAt: Date | null;
  teamId?: string | null;
}): Promise<string[]> {
  const ids = [...new Set(params.userIds)];
  if (ids.length === 0) return [];

  await db
    .insert(enrollments)
    .values(
      ids.map((userId) => ({
        orgId: params.orgId,
        courseId: params.courseId,
        userId,
        assignedBy: params.assignedBy,
        assignedTeamId: params.teamId ?? null,
        dueAt: params.dueAt,
      })),
    )
    .onConflictDoUpdate({
      target: [enrollments.courseId, enrollments.userId],
      set: {
        assignedBy: params.assignedBy,
        assignedTeamId: params.teamId ?? null,
        dueAt: params.dueAt,
      },
    });

  return ids;
}

export type EnrollmentRow = {
  courseId: string;
  title: string;
  status: "enrolled" | "completed";
  assignedBy: string | null;
  dueAt: Date | null;
  enrolledAt: Date;
  completedAt: Date | null;
};

/** Every enrollment for a learner (any status), with course info. */
export function listEnrollmentsWithCourse(
  orgId: string,
  userId: string,
): Promise<EnrollmentRow[]> {
  return db
    .select({
      courseId: courses.id,
      title: courses.title,
      status: enrollments.status,
      assignedBy: enrollments.assignedBy,
      dueAt: enrollments.dueAt,
      enrolledAt: enrollments.enrolledAt,
      completedAt: enrollments.completedAt,
    })
    .from(enrollments)
    .innerJoin(courses, eq(enrollments.courseId, courses.id))
    .where(
      and(
        eq(enrollments.orgId, orgId),
        eq(enrollments.userId, userId),
        ne(courses.status, "archived"),
      ),
    );
}

/** Enrollment ids that already exist for a course/user set (for diffing). */
export async function existingEnrolleeIds(
  courseId: string,
  userIds: string[],
): Promise<Set<string>> {
  if (userIds.length === 0) return new Set();
  const rows = await db
    .select({ userId: enrollments.userId })
    .from(enrollments)
    .where(
      and(
        eq(enrollments.courseId, courseId),
        inArray(enrollments.userId, userIds),
      ),
    );
  return new Set(rows.map((r) => r.userId));
}
