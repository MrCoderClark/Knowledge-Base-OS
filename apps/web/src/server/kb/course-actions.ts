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
  setCourseStatus,
  updateCourse,
} from "./courses";
import { completeEnrollmentIfDone, ensureEnrollment } from "./enrollments";
import type { CourseFormState } from "./kb-types";

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
  await completeEnrollmentIfDone(courseId, actor.userId);
  revalidatePath(`/courses/${courseId}`);
  revalidatePath("/");
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
