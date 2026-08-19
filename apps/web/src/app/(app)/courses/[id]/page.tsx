import { Check, Clock, ListVideo, Play } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getActor, hasPermission } from "@/server/authz";
import { completedLessonIds, getCourse, getCourseLessons } from "@/server/kb/courses";
import { ensureEnrollment } from "@/server/kb/enrollments";
import { getVideoProgressMap } from "@/server/kb/progress";
import { getVideo } from "@/server/kb/videos";
import { LessonPlayer } from "../LessonPlayer";

function fmtDuration(total: number): string | null {
  if (!total) return null;
  const m = Math.round(total / 60);
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)}h ${m % 60}m`;
}

export default async function CourseViewPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ lesson?: string }>;
}) {
  const { id } = await params;
  const { lesson: lessonParam } = await searchParams;
  const actor = await getActor();
  if (!actor) redirect("/signin");

  const course = await getCourse(actor.orgId, id);
  if (!course) notFound();
  const canManage = hasPermission(actor.role, "course:manage");
  if (course.status !== "published" && !canManage) notFound();

  const lessons = await getCourseLessons(id);
  const completed = new Set(await completedLessonIds(actor.userId, id));
  const progress = await getVideoProgressMap(
    actor.userId,
    lessons.map((l) => l.itemId),
  );

  const pct =
    lessons.length > 0
      ? Math.round((completed.size / lessons.length) * 100)
      : 0;

  const header = (
    <header className="mb-6">
      <Link
        href="/courses"
        className="mb-3 inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted hover:text-slate"
      >
        ← Back to training
      </Link>
      <div className="flex items-start justify-between gap-4">
        <h1 className="text-[32px] font-semibold leading-tight tracking-tight text-heading">
          {course.title}
        </h1>
        {canManage && (
          <Link
            href={`/courses/${course.id}/edit`}
            className="flex h-9 items-center rounded-lg border border-border px-3 text-sm font-medium text-body hover:border-border-strong hover:text-slate"
          >
            Edit
          </Link>
        )}
      </div>
      {lessons.length > 0 && (
        <div className="mt-3 flex items-center gap-3">
          <div className="h-1.5 w-48 overflow-hidden rounded-full bg-nav-active">
            <div className="h-full rounded-full bg-indigo" style={{ width: `${pct}%` }} />
          </div>
          <span className="text-sm text-body">
            {completed.size}/{lessons.length} complete
          </span>
        </div>
      )}
    </header>
  );

  if (lessons.length === 0) {
    return (
      <div className="mx-auto max-w-[1200px] px-8 py-8">
        {header}
        <p className="rounded-xl border border-border bg-surface px-6 py-16 text-center text-sm text-body">
          This course has no lessons yet.
        </p>
      </div>
    );
  }

  const validLesson =
    lessonParam != null && lessons.some((l) => l.id === lessonParam);

  const lessonList = (
    <ol className="space-y-1">
      {lessons.map((l, i) => {
        const isCurrent = validLesson && l.id === lessonParam;
        const isDone = completed.has(l.id);
        const watchPct = isDone ? 100 : (progress.get(l.itemId)?.progressPct ?? 0);
        return (
          <li key={l.id}>
            <Link
              href={`/courses/${course.id}?lesson=${l.id}`}
              className={`flex items-center gap-3 rounded-md px-2 py-2 text-sm ${
                isCurrent ? "bg-nav-active" : "hover:bg-nav-active"
              }`}
            >
              <span
                className={`flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] ${
                  isDone ? "bg-success text-white" : "border border-border text-muted"
                }`}
              >
                {isDone ? <Check className="size-3" /> : i + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span
                  className={`block truncate ${isCurrent ? "font-medium text-heading" : "text-body"}`}
                >
                  {l.overrideTitle ?? l.videoTitle ?? "Lesson"}
                </span>
                {!isDone && watchPct > 0 && (
                  <span className="mt-1 flex items-center gap-2">
                    <span className="h-1 w-full overflow-hidden rounded-full bg-nav-active">
                      <span
                        className="block h-full rounded-full bg-indigo"
                        style={{ width: `${watchPct}%` }}
                      />
                    </span>
                    <span className="shrink-0 text-[10px] text-muted">{watchPct}%</span>
                  </span>
                )}
              </span>
            </Link>
          </li>
        );
      })}
    </ol>
  );

  /* -------- Overview (no lesson selected) -------- */
  if (!validLesson) {
    const resumeId =
      lessons.find((l) => !completed.has(l.id))?.id ?? lessons[0].id;
    const started =
      completed.size > 0 ||
      lessons.some((l) => (progress.get(l.itemId)?.progressPct ?? 0) > 0);
    const cta =
      completed.size === lessons.length
        ? "Review course"
        : started
          ? "Continue"
          : "Start course";
    const totalDuration = fmtDuration(
      lessons.reduce((s, l) => s + (l.videoDuration ?? 0), 0),
    );

    return (
      <div className="mx-auto max-w-[1200px] px-8 py-8">
        {header}
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <div className="rounded-xl border border-border bg-surface p-6">
              {course.description ? (
                <p className="whitespace-pre-line text-body">{course.description}</p>
              ) : (
                <p className="text-muted">No description provided.</p>
              )}
              <div className="mt-5 flex flex-wrap items-center gap-4 text-sm text-muted">
                <span className="inline-flex items-center gap-1.5">
                  <ListVideo className="size-4" />
                  {lessons.length} lesson{lessons.length === 1 ? "" : "s"}
                </span>
                {totalDuration && (
                  <span className="inline-flex items-center gap-1.5">
                    <Clock className="size-4" />
                    {totalDuration}
                  </span>
                )}
              </div>
              <Link
                href={`/courses/${course.id}?lesson=${resumeId}`}
                className="mt-6 inline-flex h-11 items-center gap-2 rounded-lg bg-slate px-5 text-sm font-semibold text-white hover:opacity-90"
              >
                <Play className="size-4" />
                {cta}
              </Link>
            </div>
          </div>
          <aside>
            <h2 className="mb-3 border-b border-border pb-2 text-lg font-semibold text-heading">
              Lessons
            </h2>
            {lessonList}
          </aside>
        </div>
      </div>
    );
  }

  /* -------- Player (a lesson is selected) -------- */
  // Enroll the learner the moment they actually start a published course.
  if (course.status === "published") {
    await ensureEnrollment(actor.orgId, course.id, actor.userId);
  }

  const currentIndex = lessons.findIndex((l) => l.id === lessonParam);
  const current = lessons[currentIndex];
  const nextLesson = lessons[currentIndex + 1] ?? null;
  const video = await getVideo(actor.orgId, current.itemId);

  const player =
    video && video.status === "ready"
      ? {
          src: video.hlsKey
            ? `/api/videos/${video.id}/hls/master.m3u8`
            : `/api/videos/${video.id}/file`,
          type: video.hlsKey ? "application/vnd.apple.mpegurl" : "video/mp4",
          title: current.videoTitle ?? "Lesson",
          videoId: video.id,
          captions: video.captionsKey
            ? `/api/videos/${video.id}/captions`
            : undefined,
          thumbnails: video.spriteKey
            ? `/api/videos/${video.id}/sprite/sprite.vtt`
            : undefined,
          resumeAt: completed.has(current.id)
            ? 0
            : progress.get(current.itemId)?.lastPositionSeconds,
        }
      : null;

  return (
    <div className="mx-auto max-w-[1200px] px-8 py-8">
      {header}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <LessonPlayer
            courseId={course.id}
            lessonId={current.id}
            nextLessonId={nextLesson?.id ?? null}
            nextLessonTitle={
              nextLesson
                ? (nextLesson.overrideTitle ?? nextLesson.videoTitle ?? "Next lesson")
                : null
            }
            player={player}
            completed={completed.has(current.id)}
          />

          <div className="rounded-xl border border-border bg-surface p-5">
            <div className="text-xs uppercase tracking-wider text-muted">
              Lesson {currentIndex + 1} of {lessons.length}
            </div>
            <div className="font-semibold text-heading">
              {current.overrideTitle ?? current.videoTitle ?? "Lesson"}
            </div>
            <p className="mt-1 text-sm text-muted">
              This lesson completes automatically once you watch it to the end.
            </p>
          </div>
        </div>

        <aside>
          <h2 className="mb-3 border-b border-border pb-2 text-lg font-semibold text-heading">
            Lessons
          </h2>
          {lessonList}
        </aside>
      </div>
    </div>
  );
}
