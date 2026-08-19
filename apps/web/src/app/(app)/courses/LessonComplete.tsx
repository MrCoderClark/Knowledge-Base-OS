"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { completeLessonAction } from "@/server/kb/course-actions";

type Props = {
  courseId: string;
  lessonId: string;
  nextLessonId: string | null;
  completed: boolean;
};

export function LessonComplete({
  courseId,
  lessonId,
  nextLessonId,
  completed,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function go() {
    startTransition(async () => {
      if (!completed) await completeLessonAction(courseId, lessonId);
      router.push(
        nextLessonId
          ? `/courses/${courseId}?lesson=${nextLessonId}`
          : `/courses/${courseId}`,
      );
      router.refresh();
    });
  }

  const label = completed
    ? nextLessonId
      ? "Next lesson"
      : "Back to course"
    : nextLessonId
      ? "Mark complete & continue"
      : "Mark complete & finish";

  return (
    <button
      type="button"
      onClick={go}
      disabled={pending}
      className="h-10 rounded-lg bg-slate px-4 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60"
    >
      {pending ? "…" : label}
    </button>
  );
}
