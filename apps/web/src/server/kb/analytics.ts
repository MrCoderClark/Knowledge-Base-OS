import { and, asc, desc, eq, sql } from "drizzle-orm";
import { db } from "@/server/db";
import {
  courseLessons,
  courses,
  enrollments,
  users,
} from "@/server/db/schema";

export type CourseAnalyticsRow = {
  courseId: string;
  title: string;
  status: "draft" | "published" | "archived";
  required: boolean;
  enrolled: number;
  completed: number;
  overdue: number;
  completionRate: number;
};

/** Per-course enrollment/completion/overdue counts for the admin dashboard. */
export async function courseAnalytics(
  orgId: string,
): Promise<CourseAnalyticsRow[]> {
  const rows = await db
    .select({
      courseId: courses.id,
      title: courses.title,
      status: courses.status,
      required: courses.required,
      enrolled: sql<number>`count(${enrollments.id})`.mapWith(Number),
      completed:
        sql<number>`count(${enrollments.id}) filter (where ${enrollments.status} = 'completed')`.mapWith(
          Number,
        ),
      overdue:
        sql<number>`count(${enrollments.id}) filter (where ${enrollments.status} = 'enrolled' and ${enrollments.dueAt} is not null and ${enrollments.dueAt} < now())`.mapWith(
          Number,
        ),
    })
    .from(courses)
    .leftJoin(enrollments, eq(enrollments.courseId, courses.id))
    .where(eq(courses.orgId, orgId))
    .groupBy(courses.id)
    .orderBy(desc(courses.required), asc(courses.title));

  return rows.map((r) => ({
    ...r,
    completionRate:
      r.enrolled > 0 ? Math.round((r.completed / r.enrolled) * 100) : 0,
  }));
}

export type OrgSummary = {
  totalCourses: number;
  requiredCourses: number;
  totalEnrollments: number;
  completedEnrollments: number;
  overdueEnrollments: number;
  complianceRate: number; // completed / required-course enrollments
};

/** Org-wide rollup for the top of the analytics page. */
export function orgSummary(rows: CourseAnalyticsRow[]): OrgSummary {
  const required = rows.filter((r) => r.required);
  const reqEnrolled = required.reduce((s, r) => s + r.enrolled, 0);
  const reqCompleted = required.reduce((s, r) => s + r.completed, 0);
  return {
    totalCourses: rows.length,
    requiredCourses: required.length,
    totalEnrollments: rows.reduce((s, r) => s + r.enrolled, 0),
    completedEnrollments: rows.reduce((s, r) => s + r.completed, 0),
    overdueEnrollments: rows.reduce((s, r) => s + r.overdue, 0),
    complianceRate:
      reqEnrolled > 0 ? Math.round((reqCompleted / reqEnrolled) * 100) : 0,
  };
}

export type LearnerRow = {
  userId: string;
  name: string | null;
  email: string;
  status: "enrolled" | "completed";
  dueAt: Date | null;
  completedAt: Date | null;
  doneLessons: number;
  totalLessons: number;
  pct: number;
  overdue: boolean;
};

/** Per-learner progress within a course (admin table + CSV export). */
export async function learnerProgress(
  courseId: string,
): Promise<LearnerRow[]> {
  const [{ total }] = await db
    .select({ total: sql<number>`count(*)`.mapWith(Number) })
    .from(courseLessons)
    .where(eq(courseLessons.courseId, courseId));

  const rows = await db
    .select({
      userId: users.id,
      name: users.name,
      email: users.email,
      status: enrollments.status,
      dueAt: enrollments.dueAt,
      completedAt: enrollments.completedAt,
      doneLessons: sql<number>`(
        select count(*) from lesson_completions lc
        join course_lessons cl on lc.course_lesson_id = cl.id
        where cl.course_id = ${courseId} and lc.user_id = ${users.id}
      )`.mapWith(Number),
    })
    .from(enrollments)
    .innerJoin(users, eq(enrollments.userId, users.id))
    .where(eq(enrollments.courseId, courseId))
    .orderBy(asc(users.name));

  const now = Date.now();
  return rows.map((r) => ({
    ...r,
    totalLessons: total,
    pct: total > 0 ? Math.round((r.doneLessons / total) * 100) : 0,
    overdue:
      r.status === "enrolled" && r.dueAt != null && r.dueAt.getTime() < now,
  }));
}

/** Course title + org check for export/detail routes. */
export async function getCourseMeta(orgId: string, courseId: string) {
  const [row] = await db
    .select({ id: courses.id, title: courses.title })
    .from(courses)
    .where(and(eq(courses.id, courseId), eq(courses.orgId, orgId)));
  return row ?? null;
}
