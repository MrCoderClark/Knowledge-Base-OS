"use client";

import { ArrowDown, ArrowUp, Plus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import {
  addLessonAction,
  deleteCourseAction,
  removeLessonAction,
  reorderLessonsAction,
  setCourseStatusAction,
} from "@/server/kb/course-actions";

type Lesson = { id: string; title: string; duration: number | null };
type Video = { id: string; title: string };

function fmt(sec: number | null): string {
  if (!sec) return "";
  const m = Math.floor(sec / 60);
  const s = String(Math.round(sec % 60)).padStart(2, "0");
  return `${m}:${s}`;
}

export function CourseBuilder({
  courseId,
  status,
  lessons,
  availableVideos,
}: {
  courseId: string;
  status: string;
  lessons: Lesson[];
  availableVideos: Video[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const run = (fn: () => Promise<void>) =>
    startTransition(async () => {
      await fn();
      router.refresh();
    });

  function move(index: number, dir: -1 | 1) {
    const next = [...lessons];
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    run(() => reorderLessonsAction(courseId, next.map((l) => l.id)));
  }

  return (
    <div className="space-y-8">
      <section className="rounded-xl border border-border bg-surface p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-heading">
            Lessons
            <span className="ml-2 text-sm font-normal text-muted">
              {lessons.length}
            </span>
          </h2>
          <div className="flex items-center gap-3">
            <button
              type="button"
              disabled={pending || lessons.length === 0}
              onClick={() =>
                run(() =>
                  setCourseStatusAction(
                    courseId,
                    status === "published" ? "draft" : "published",
                  ),
                )
              }
              className="h-9 rounded-lg bg-slate px-3 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
            >
              {status === "published" ? "Unpublish" : "Publish"}
            </button>
            <ConfirmDialog
              title="Delete course?"
              description="The course and its lesson list are removed (the videos are kept)."
              confirmLabel="Delete"
              onConfirm={async () => {
                await deleteCourseAction(courseId);
                router.push("/courses");
              }}
              trigger={
                <button
                  type="button"
                  className="text-sm font-medium text-danger hover:underline"
                >
                  Delete
                </button>
              }
            />
          </div>
        </div>

        {lessons.length === 0 ? (
          <p className="text-sm text-body">
            No lessons yet — add videos below.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {lessons.map((l, i) => (
              <li key={l.id} className="flex items-center gap-3 py-2.5">
                <span className="w-6 text-center text-sm text-muted">{i + 1}</span>
                <span className="flex-1 text-sm font-medium text-heading">
                  {l.title}
                </span>
                {l.duration != null && (
                  <span className="text-xs text-muted">{fmt(l.duration)}</span>
                )}
                <button
                  type="button"
                  disabled={pending || i === 0}
                  onClick={() => move(i, -1)}
                  className="rounded p-1 text-muted hover:bg-nav-active disabled:opacity-30"
                  aria-label="Move up"
                >
                  <ArrowUp className="size-4" />
                </button>
                <button
                  type="button"
                  disabled={pending || i === lessons.length - 1}
                  onClick={() => move(i, 1)}
                  className="rounded p-1 text-muted hover:bg-nav-active disabled:opacity-30"
                  aria-label="Move down"
                >
                  <ArrowDown className="size-4" />
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => run(() => removeLessonAction(courseId, l.id))}
                  className="rounded p-1 text-danger hover:bg-nav-active"
                  aria-label="Remove"
                >
                  <X className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-xl border border-border bg-surface p-6">
        <h2 className="mb-4 text-lg font-semibold text-heading">Add lessons</h2>
        {availableVideos.length === 0 ? (
          <p className="text-sm text-body">
            No more videos available. Upload videos, then add them here.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {availableVideos.map((v) => (
              <li key={v.id} className="flex items-center justify-between py-2.5">
                <span className="text-sm text-heading">{v.title}</span>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => run(() => addLessonAction(courseId, v.id))}
                  className="flex h-8 items-center gap-1 rounded-lg border border-border px-3 text-sm font-medium text-body hover:border-border-strong hover:text-slate"
                >
                  <Plus className="size-4" />
                  Add
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
