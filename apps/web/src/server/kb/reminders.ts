import { and, eq, gte, isNotNull, lte } from "drizzle-orm";
import { db } from "@/server/db";
import { courses, enrollments, notifications, users } from "@/server/db/schema";
import { sendCourseDueReminderEmail } from "@/server/email";
import { env } from "@/server/env";
import { createNotification } from "./notifications";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

/**
 * Notify + email learners whose assigned courses are due within 3 days or
 * overdue. Deduped so each learner/course is reminded at most once per ~20h,
 * making it safe to run on any cron cadence.
 */
export async function sendDueReminders(): Promise<{ sent: number }> {
  const now = new Date();
  const soon = new Date(now.getTime() + 3 * DAY);
  const dedupeCutoff = new Date(now.getTime() - 20 * HOUR); // remind at most 1×/20h

  const rows = await db
    .select({
      orgId: enrollments.orgId,
      userId: enrollments.userId,
      courseId: courses.id,
      courseTitle: courses.title,
      dueAt: enrollments.dueAt,
      email: users.email,
      name: users.name,
    })
    .from(enrollments)
    .innerJoin(courses, eq(enrollments.courseId, courses.id))
    .innerJoin(users, eq(enrollments.userId, users.id))
    .where(
      and(
        eq(enrollments.status, "enrolled"),
        isNotNull(enrollments.dueAt),
        lte(enrollments.dueAt, soon),
      ),
    );

  let sent = 0;
  for (const r of rows) {
    if (!r.dueAt) continue;

    const link = `/courses/${r.courseId}`;
    const [recent] = await db
      .select({ id: notifications.id })
      .from(notifications)
      .where(
        and(
          eq(notifications.userId, r.userId),
          eq(notifications.type, "course_due_soon"),
          eq(notifications.linkUrl, link),
          gte(notifications.createdAt, dedupeCutoff),
        ),
      )
      .limit(1);
    if (recent) continue;

    const overdue = r.dueAt.getTime() < now.getTime();
    await createNotification({
      orgId: r.orgId,
      userId: r.userId,
      type: "course_due_soon",
      title: overdue
        ? `Overdue: ${r.courseTitle}`
        : `Due soon: ${r.courseTitle}`,
      body: overdue
        ? "This training is past its due date."
        : `Due ${r.dueAt.toLocaleDateString()}.`,
      linkUrl: link,
    });

    try {
      await sendCourseDueReminderEmail({
        to: r.email,
        name: r.name,
        courseTitle: r.courseTitle,
        url: `${env.APP_URL}${link}`,
        dueAt: r.dueAt,
        overdue,
      });
    } catch {
      // best-effort — the in-app notification already landed
    }
    sent++;
  }
  return { sent };
}
