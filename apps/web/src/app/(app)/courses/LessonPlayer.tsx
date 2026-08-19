"use client";

import { Check, Play, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { completeLessonAction } from "@/server/kb/course-actions";
import { VideoPlayer } from "../videos/VideoPlayer";

type PlayerSrc = {
  src: string;
  type: string;
  title: string;
  videoId: string;
  captions?: string;
  thumbnails?: string;
  resumeAt?: number;
};

type Props = {
  courseId: string;
  lessonId: string;
  nextLessonId: string | null;
  nextLessonTitle: string | null;
  /** Resolved player source, or null while the video is still processing. */
  player: PlayerSrc | null;
  /** Whether this lesson was already complete on load. */
  completed: boolean;
};

const AUTOPLAY_SECONDS = 5;

export function LessonPlayer({
  courseId,
  lessonId,
  nextLessonId,
  nextLessonTitle,
  player,
  completed,
}: Props) {
  const router = useRouter();
  const [showUpNext, setShowUpNext] = useState(false);
  const [countdown, setCountdown] = useState(AUTOPLAY_SECONDS);
  // Latch so re-watching a finished lesson doesn't spam the completion flow.
  const firedRef = useRef(false);

  const goNext = useCallback(() => {
    router.push(
      nextLessonId
        ? `/courses/${courseId}?lesson=${nextLessonId}`
        : `/courses/${courseId}`,
    );
    router.refresh();
  }, [router, courseId, nextLessonId]);

  const onComplete = useCallback(() => {
    if (firedRef.current) return;
    firedRef.current = true;
    // Persist completion (idempotent); doesn't block the up-next UI.
    void completeLessonAction(courseId, lessonId);
    setCountdown(AUTOPLAY_SECONDS);
    setShowUpNext(true);
  }, [courseId, lessonId]);

  // Autoplay countdown → advance to the next lesson.
  useEffect(() => {
    if (!showUpNext || !nextLessonId) return;
    if (countdown <= 0) {
      goNext();
      return;
    }
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [showUpNext, countdown, nextLessonId, goNext]);

  return (
    <div className="relative">
      {player ? (
        <VideoPlayer
          src={player.src}
          type={player.type}
          title={player.title}
          captions={player.captions}
          thumbnails={player.thumbnails}
          videoId={player.videoId}
          resumeAt={player.resumeAt}
          autoPlay
          onComplete={onComplete}
        />
      ) : (
        <div className="flex aspect-video w-full items-center justify-center rounded-xl border border-border bg-surface text-sm text-muted">
          This lesson&apos;s video is still processing.
        </div>
      )}

      {/* Completion state / up-next overlay */}
      {showUpNext && (
        <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-slate/85 p-6 text-center backdrop-blur-sm">
          <div className="max-w-sm">
            <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-full bg-success text-white">
              <Check className="size-6" />
            </div>
            {nextLessonId ? (
              <>
                <div className="text-sm font-medium uppercase tracking-wider text-white/70">
                  Lesson complete · Up next
                </div>
                <div className="mt-1 text-lg font-semibold text-white">
                  {nextLessonTitle ?? "Next lesson"}
                </div>
                <div className="mt-5 flex items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={goNext}
                    className="inline-flex h-10 items-center gap-2 rounded-lg bg-white px-4 text-sm font-semibold text-slate hover:opacity-90"
                  >
                    <Play className="size-4" />
                    Play now ({countdown})
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowUpNext(false)}
                    className="inline-flex h-10 items-center gap-2 rounded-lg border border-white/40 px-4 text-sm font-medium text-white hover:bg-white/10"
                  >
                    <X className="size-4" />
                    Cancel
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="text-lg font-semibold text-white">
                  Course complete 🎉
                </div>
                <div className="mt-1 text-sm text-white/80">
                  You&apos;ve finished every lesson.
                </div>
                <button
                  type="button"
                  onClick={goNext}
                  className="mt-5 inline-flex h-10 items-center rounded-lg bg-white px-4 text-sm font-semibold text-slate hover:opacity-90"
                >
                  Back to course
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Quiet completed marker when not showing the overlay. */}
      {completed && !showUpNext && (
        <div className="pointer-events-none absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-success px-2.5 py-1 text-xs font-semibold text-white shadow">
          <Check className="size-3.5" />
          Completed
        </div>
      )}
    </div>
  );
}
