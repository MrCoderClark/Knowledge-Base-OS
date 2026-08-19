import {
  ArrowLeft,
  BadgeCheck,
  Calendar,
  Clock,
  Film,
  FileText,
  ListVideo,
  User,
} from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getActor, hasPermission } from "@/server/authz";
import { getVideoProgress } from "@/server/kb/progress";
import { getVideoWithMeta, relatedVideos } from "@/server/kb/videos";
import { ChapterList } from "../ChapterList";
import { PlayerProvider } from "../player-context";
import { TranscriptPanel } from "../TranscriptPanel";
import { VideoActionBar } from "../VideoActionBar";
import { VideoActions } from "../VideoActions";
import { VideoFailed } from "../VideoFailed";
import { VideoPlayer } from "../VideoPlayer";
import { VideoProcessing } from "../VideoProcessing";

function fmtDuration(s: number | null): string | null {
  if (!s) return null;
  const sec = Math.round(s);
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const ss = String(sec % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}

function fmtDate(d: Date): string {
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default async function VideoViewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const actor = await getActor();
  if (!actor) redirect("/signin");

  const video = await getVideoWithMeta(actor.orgId, id);
  if (!video) notFound();

  const related = await relatedVideos(actor.orgId, id);
  const resume = await getVideoProgress(actor.userId, id);
  const resumeAt = resume?.lastPositionSeconds ?? undefined;
  const duration = fmtDuration(video.durationSeconds);
  const chapters =
    (video.chapters as { start: number; title: string }[] | null) ?? [];

  return (
    <div className="mx-auto max-w-[1200px] px-8 py-8">
      <Link
        href="/videos"
        className="mb-4 inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted hover:text-slate"
      >
        <ArrowLeft className="size-3.5" />
        Back to videos
      </Link>

      <div className="flex items-start justify-between gap-4">
        <h1 className="text-[32px] font-semibold leading-tight tracking-tight text-heading">
          {video.title}
        </h1>
        <VideoActions
          id={video.id}
          canEdit={hasPermission(actor.role, "video:update")}
          canDelete={hasPermission(actor.role, "video:delete")}
        />
      </div>

      {/* Meta row */}
      <div className="mb-6 mt-2 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-body">
        {video.categoryName && (
          <span
            className="inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-semibold"
            style={{
              color: video.categoryColor ?? "#6366F1",
              backgroundColor: `${video.categoryColor ?? "#6366F1"}1a`,
            }}
          >
            <BadgeCheck className="size-3.5" />
            {video.categoryName}
          </span>
        )}
        <span className="inline-flex items-center gap-1.5">
          <User className="size-4 text-muted" />
          {video.authorName ?? "Unknown"}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Calendar className="size-4 text-muted" />
          {fmtDate(video.createdAt)}
        </span>
        {duration && (
          <span className="inline-flex items-center gap-1.5">
            <Clock className="size-4 text-muted" />
            {duration}
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        {/* Main column */}
        <div className="space-y-6 lg:col-span-2">
          <PlayerProvider>
          {video.status === "ready" ? (
            video.hlsKey ? (
              <VideoPlayer
                src={`/api/videos/${video.id}/hls/master.m3u8`}
                type="application/vnd.apple.mpegurl"
                title={video.title}
                videoId={video.id}
                resumeAt={resumeAt}
                thumbnails={
                  video.spriteKey
                    ? `/api/videos/${video.id}/sprite/sprite.vtt`
                    : undefined
                }
                captions={
                  video.captionsKey
                    ? `/api/videos/${video.id}/captions`
                    : undefined
                }
              />
            ) : (
              <VideoPlayer
                src={`/api/videos/${video.id}/file`}
                type="video/mp4"
                title={video.title}
                videoId={video.id}
                resumeAt={resumeAt}
                thumbnails={
                  video.spriteKey
                    ? `/api/videos/${video.id}/sprite/sprite.vtt`
                    : undefined
                }
                captions={
                  video.captionsKey
                    ? `/api/videos/${video.id}/captions`
                    : undefined
                }
              />
            )
          ) : video.status === "failed" ? (
            <VideoFailed
              id={video.id}
              error={video.processingError}
              canRetry={hasPermission(actor.role, "video:update")}
            />
          ) : (
            <VideoProcessing />
          )}

          <div className="rounded-xl border border-border bg-surface p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <p className="max-w-md whitespace-pre-line text-body">
                {video.description || "No description provided."}
              </p>
              <VideoActionBar id={video.id} />
            </div>
          </div>

          {video.status === "ready" && (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div className="rounded-xl border border-border bg-surface p-5">
                <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-heading">
                  <ListVideo className="size-5 text-indigo" />
                  Chapters
                </h2>
                {chapters.length === 0 ? (
                  <p className="text-sm text-muted">
                    {video.captionsKey
                      ? "No chapters."
                      : "Generating from the transcript…"}
                  </p>
                ) : (
                  <ChapterList chapters={chapters} />
                )}
              </div>

              <div className="rounded-xl border border-border bg-surface p-5">
                <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-heading">
                  <FileText className="size-5 text-indigo" />
                  Transcript
                </h2>
                {video.captionsKey ? (
                  <TranscriptPanel
                    captionsUrl={`/api/videos/${video.id}/captions`}
                  />
                ) : (
                  <p className="text-sm text-muted">
                    Transcript is being generated…
                  </p>
                )}
              </div>
            </div>
          )}
          </PlayerProvider>
        </div>

        {/* Up Next */}
        <aside>
          <h2 className="mb-3 border-b border-border pb-2 text-lg font-semibold text-heading">
            Up Next
          </h2>
          {related.length === 0 ? (
            <p className="text-sm text-muted">No other videos yet.</p>
          ) : (
            <ul className="space-y-4">
              {related.map((r) => {
                const d = fmtDuration(r.durationSeconds);
                return (
                  <li key={r.id}>
                    <Link href={`/videos/${r.id}`} className="group flex gap-3">
                      <div className="relative h-14 w-24 shrink-0 overflow-hidden rounded-lg bg-gradient-to-br from-indigo-soft to-nav-active">
                        {r.posterKey ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={`/api/videos/${r.id}/poster`}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <span className="flex h-full w-full items-center justify-center">
                            <Film className="size-5 text-indigo/70" />
                          </span>
                        )}
                        {d && (
                          <span className="absolute bottom-1 right-1 rounded bg-slate/80 px-1 text-[10px] font-medium text-white">
                            {d}
                          </span>
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="line-clamp-2 text-sm font-medium text-heading group-hover:text-indigo">
                          {r.title}
                        </div>
                        {r.categoryName && (
                          <div className="text-xs text-muted">{r.categoryName}</div>
                        )}
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
          <Link
            href="/videos"
            className="mt-4 flex h-10 items-center justify-center rounded-lg border border-dashed border-border text-sm font-medium text-indigo hover:border-indigo"
          >
            View More Videos
          </Link>
        </aside>
      </div>
    </div>
  );
}
