"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getActor, requirePermission } from "@/server/authz";
import {
  addVideoLesson,
  createCourse,
  deleteCourse,
  getCourse,
  markLessonComplete,
  removeLesson,
  reorderLessons,
  setCourseFlags,
  setCourseStatus,
  updateCourse,
} from "./courses";
import { env } from "@/server/env";
import { sendCourseAssignedEmail } from "@/server/email";
import { finalizeCourseIfComplete } from "./course-completion";
import { assignCourse, ensureEnrollment, teamMemberIds } from "./enrollments";
import type { CourseFormState } from "./kb-types";
import { listOrgMembers } from "./members";
import { notifyMany } from "./notifications";

const courseSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().optional(),
  categoryId: z.string().uuid().nullable().optional(),
});

/** Create or update a course's metadata. On create, redirect to the builder. */
export async function saveCourseAction(
  _prev: CourseFormState,
  formData: FormData,
): Promise<CourseFormState> {
  let actor;
  try {
    actor = await requirePermission("course:manage");
  } catch {
    return { error: "You don't have permission to manage courses." };
  }

  const parsed = courseSchema.safeParse({
    id: (formData.get("id") as string) || undefined,
    title: formData.get("title"),
    description: (formData.get("description") as string) || undefined,
    categoryId: (formData.get("categoryId") as string) || null,
  });
  if (!parsed.success) return { error: "A course title is required." };

  const description = parsed.data.description ?? null;
  const categoryId = parsed.data.categoryId ?? null;

  if (parsed.data.id) {
    await updateCourse({
      orgId: actor.orgId,
      id: parsed.data.id,
      title: parsed.data.title,
      description,
      categoryId,
      updatedBy: actor.userId,
    });
    revalidatePath(`/courses/${parsed.data.id}`);
    redirect(`/courses/${parsed.data.id}/edit`);
  }

  const id = await createCourse({
    orgId: actor.orgId,
    title: parsed.data.title,
    description,
    categoryId,
    createdBy: actor.userId,
  });
  redirect(`/courses/${id}/edit`);
}

async function requireCourse(courseId: string) {
  const actor = await requirePermission("course:manage");
  const course = await getCourse(actor.orgId, courseId);
  if (!course) throw new Error("Not found");
  return { actor, course };
}

export async function setCourseStatusAction(
  courseId: string,
  status: "draft" | "published" | "archived",
): Promise<void> {
  const { actor } = await requireCourse(courseId);
  await setCourseStatus({ orgId: actor.orgId, id: courseId, status });
  revalidatePath(`/courses/${courseId}`);
  revalidatePath("/courses");
}

export async function setCourseFlagsAction(
  courseId: string,
  required: boolean,
  antiSkip: boolean,
): Promise<void> {
  const { actor } = await requireCourse(courseId);
  await setCourseFlags({ orgId: actor.orgId, id: courseId, required, antiSkip });
  revalidatePath(`/courses/${courseId}`);
  revalidatePath(`/courses/${courseId}/edit`);
  revalidatePath("/analytics");
}

export async function deleteCourseAction(courseId: string): Promise<void> {
  const { actor } = await requireCourse(courseId);
  await deleteCourse({ orgId: actor.orgId, id: courseId });
  revalidatePath("/courses");
}

export async function addLessonAction(
  courseId: string,
  videoId: string,
): Promise<void> {
  await requireCourse(courseId);
  await addVideoLesson(courseId, videoId);
  revalidatePath(`/courses/${courseId}/edit`);
}

export async function removeLessonAction(
  courseId: string,
  lessonId: string,
): Promise<void> {
  await requireCourse(courseId);
  await removeLesson(courseId, lessonId);
  revalidatePath(`/courses/${courseId}/edit`);
}

export async function reorderLessonsAction(
  courseId: string,
  orderedLessonIds: string[],
): Promise<void> {
  await requireCourse(courseId);
  await reorderLessons(courseId, orderedLessonIds);
  revalidatePath(`/courses/${courseId}/edit`);
}

/**
 * Learner action — mark a lesson complete for the current user. Called by the
 * player when a lesson is watched to the end (≥95%). Ensures the learner is
 * enrolled and flips the enrollment to `completed` once every lesson is done.
 */
export async function completeLessonAction(
  courseId: string,
  lessonId: string,
): Promise<void> {
  const actor = await getActor();
  if (!actor) return;
  await ensureEnrollment(actor.orgId, courseId, actor.userId);
  await markLessonComplete(actor.userId, lessonId);
  // Completes the enrollment + issues the certificate only if there's no
  // course quiz, or the learner has already passed it.
  await finalizeCourseIfComplete(actor.orgId, actor.userId, courseId);
  revalidatePath(`/courses/${courseId}`);
  revalidatePath("/");
  revalidatePath("/my-learning");
}

/** Admin action — assign a course to users and/or a whole team. */
export async function assignCourseAction(input: {
  courseId: string;
  userIds: string[];
  teamId: string | null;
  dueAt: string | null;
}): Promise<{ ok?: number; error?: string }> {
  let actor;
  try {
    actor = await requirePermission("course:manage");
  } catch {
    return { error: "You don't have permission to assign courses." };
  }

  const course = await getCourse(actor.orgId, input.courseId);
  if (!course) return { error: "Course not found." };

  let userIds = [...input.userIds];
  if (input.teamId) {
    userIds = userIds.concat(await teamMemberIds(input.teamId));
  }
  userIds = [...new Set(userIds)];
  if (userIds.length === 0) {
    return { error: "Select at least one person or a team." };
  }

  const dueAt = input.dueAt ? new Date(input.dueAt) : null;
  const assigned = await assignCourse({
    orgId: actor.orgId,
    courseId: input.courseId,
    userIds,
    assignedBy: actor.userId,
    dueAt,
    teamId: input.teamId,
  });

  const link = `/courses/${input.courseId}`;
  const dueBody = dueAt
    ? `Due ${dueAt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`
    : null;
  await notifyMany(
    assigned.map((userId) => ({
      orgId: actor.orgId,
      userId,
      type: "course_assigned" as const,
      title: `New training assigned: ${course.title}`,
      body: dueBody,
      linkUrl: link,
    })),
  );

  // Email is best-effort — a mail failure must not fail the assignment.
  try {
    const members = await listOrgMembers(actor.orgId);
    const byId = new Map(members.map((m) => [m.userId, m]));
    await Promise.all(
      assigned.map((userId) => {
        const m = byId.get(userId);
        if (!m) return Promise.resolve();
        return sendCourseAssignedEmail({
          to: m.email,
          name: m.name,
          courseTitle: course.title,
          url: `${env.APP_URL}${link}`,
          dueAt,
        });
      }),
    );
  } catch {
    // swallow — notifications already delivered in-app
  }

  revalidatePath("/my-learning");
  return { ok: assigned.length };
}

/** Learner action — self-enroll in a course (idempotent). */
export async function enrollAction(courseId: string): Promise<void> {
  const actor = await getActor();
  if (!actor) return;
  const course = await getCourse(actor.orgId, courseId);
  if (!course) return;
  await ensureEnrollment(actor.orgId, courseId, actor.userId);
  revalidatePath(`/courses/${courseId}`);
}
