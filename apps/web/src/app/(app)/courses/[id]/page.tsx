import { Check } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getActor, hasPermission } from "@/server/authz";
import { completedLessonIds, getCourse, getCourseLessons } from "@/server/kb/courses";
import { getVideo } from "@/server/kb/videos";
import { PlayerProvider } from "../../videos/player-context";
import { VideoPlayer } from "../../videos/VideoPlayer";
import { LessonComplete } from "../LessonComplete";

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

  const currentId =
    lessonParam && lessons.some((l) => l.id === lessonParam)
      ? lessonParam
      : (lessons.find((l) => !completed.has(l.id))?.id ?? lessons[0].id);
  const currentIndex = lessons.findIndex((l) => l.id === currentId);
  const current = lessons[currentIndex];
  const nextLessonId = lessons[currentIndex + 1]?.id ?? null;
  const video = await getVideo(actor.orgId, current.itemId);

  return (
    <div className="mx-auto max-w-[1200px] px-8 py-8">
      {header}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <PlayerProvider>
            {video && video.status === "ready" ? (
              <VideoPlayer
                src={
                  video.hlsKey
                    ? `/api/videos/${video.id}/hls/master.m3u8`
                    : `/api/videos/${video.id}/file`
                }
                type={
                  video.hlsKey ? "application/vnd.apple.mpegurl" : "video/mp4"
                }
                title={current.videoTitle ?? "Lesson"}
                captions={
                  video.captionsKey
                    ? `/api/videos/${video.id}/captions`
                    : undefined
                }
                thumbnails={
                  video.spriteKey
                    ? `/api/videos/${video.id}/sprite/sprite.vtt`
                    : undefined
                }
              />
            ) : (
              <div className="flex aspect-video w-full items-center justify-center rounded-xl border border-border bg-surface text-sm text-muted">
                This lesson&apos;s video is still processing.
              </div>
            )}
          </PlayerProvider>

          <div className="flex items-center justify-between rounded-xl border border-border bg-surface p-5">
            <div>
              <div className="text-xs uppercase tracking-wider text-muted">
                Lesson {currentIndex + 1} of {lessons.length}
              </div>
              <div className="font-semibold text-heading">
                {current.overrideTitle ?? current.videoTitle ?? "Lesson"}
              </div>
            </div>
            <LessonComplete
              courseId={course.id}
              lessonId={current.id}
              nextLessonId={nextLessonId}
              completed={completed.has(current.id)}
            />
          </div>
        </div>

        <aside>
          <h2 className="mb-3 border-b border-border pb-2 text-lg font-semibold text-heading">
            Lessons
          </h2>
          <ol className="space-y-1">
            {lessons.map((l, i) => {
              const isCurrent = l.id === currentId;
              const isDone = completed.has(l.id);
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
                        isDone
                          ? "bg-success text-white"
                          : "border border-border text-muted"
                      }`}
                    >
                      {isDone ? <Check className="size-3" /> : i + 1}
                    </span>
                    <span
                      className={`truncate ${isCurrent ? "font-medium text-heading" : "text-body"}`}
                    >
                      {l.overrideTitle ?? l.videoTitle ?? "Lesson"}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ol>
        </aside>
      </div>
    </div>
  );
}
