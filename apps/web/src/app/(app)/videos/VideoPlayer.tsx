"use client";

import "@vidstack/react/player/styles/default/theme.css";
import "@vidstack/react/player/styles/default/layouts/video.css";

import HLS from "hls.js";
import {
  isHLSProvider,
  MediaPlayer,
  type MediaPlayerInstance,
  MediaProvider,
  type MediaProviderAdapter,
  type TextTrackListModeChangeEvent,
  Track,
} from "@vidstack/react";
import {
  DefaultVideoLayout,
  defaultLayoutIcons,
} from "@vidstack/react/player/layouts/default";
import { useCallback, useEffect, useRef } from "react";
import { usePlayerControls } from "./player-context";

type Props = {
  src: string;
  /** e.g. "application/vnd.apple.mpegurl" for HLS, "video/mp4" otherwise. */
  type: string;
  title: string;
  /** WebVTT URL for timeline scrub previews. */
  thumbnails?: string;
  /** WebVTT URL for the caption/subtitle track. */
  captions?: string;
  /** Enables watch-progress tracking + resume for this video. */
  videoId?: string;
  /** Seconds to resume from (0/undefined starts at the beginning). */
  resumeAt?: number;
  /** Start playback automatically (used for course lessons). */
  autoPlay?: boolean;
  /** Fired once when the video is watched to the end (≥95% or `ended`). */
  onComplete?: () => void;
};

const COMPLETE_AT = 0.95; // fraction watched that counts as "complete"
const SAVE_EVERY = 10; // seconds of playback between progress saves

export function VideoPlayer({
  src,
  type,
  title,
  thumbnails,
  captions,
  videoId,
  resumeAt,
  autoPlay,
  onComplete,
}: Props) {
  const controls = usePlayerControls();
  const playerRef = useRef<MediaPlayerInstance | null>(null);

  // Dynamic values live in a ref so the player ref-callback stays stable
  // (a churning ref-callback would tear down/re-create the subscription).
  // The subscribe callback reads cfg.current at playback time — after effects
  // run — so updating it in an effect keeps it current without ref churn.
  const cfg = useRef({ videoId, resumeAt, onComplete });
  useEffect(() => {
    cfg.current = { videoId, resumeAt, onComplete };
  }, [videoId, resumeAt, onComplete]);

  const latest = useRef({ position: 0, duration: 0 });
  const resumed = useRef(false);
  const completed = useRef(false);
  const lastSavedSec = useRef(0);
  // Position we resumed to; used to avoid re-saving an unmoved spot.
  const resumedPos = useRef<number | null>(null);
  const unsub = useRef<(() => void) | null>(null);
  const capUnsub = useRef<(() => void) | null>(null);

  const save = useCallback((useBeacon = false, force = false) => {
    const id = cfg.current.videoId;
    const { position, duration } = latest.current;
    if (!id || !(duration > 0)) return;
    // Skip if the learner hasn't actually moved from where we resumed —
    // otherwise a refresh-without-watching ratchets the position backward.
    if (
      !force &&
      resumedPos.current != null &&
      Math.abs(position - resumedPos.current) < 2
    ) {
      return;
    }
    const payload = JSON.stringify({
      position: Math.floor(position),
      duration: Math.floor(duration),
    });
    const url = `/api/videos/${id}/progress`;
    if (useBeacon && typeof navigator.sendBeacon === "function") {
      navigator.sendBeacon(url, new Blob([payload], { type: "application/json" }));
    } else {
      void fetch(url, {
        method: "POST",
        body: payload,
        headers: { "Content-Type": "application/json" },
        keepalive: true,
      });
    }
  }, []);

  const register = useCallback(
    (player: MediaPlayerInstance | null) => {
      playerRef.current = player;
      controls?.register(player);
      unsub.current?.();
      unsub.current = null;
      capUnsub.current?.();
      capUnsub.current = null;
      if (!player || typeof player.subscribe !== "function") return;

      // Captions must start OFF. Vidstack remembers the last caption choice and
      // restores it on load via a *programmatic* mode change (no `trigger`); a
      // user clicking the CC button carries a trigger event, which we leave
      // alone. So we only undo the restored/auto enables.
      const tracks = player.textTracks;
      const onModeChange = (e: TextTrackListModeChangeEvent) => {
        if (e.detail.mode === "showing" && e.trigger == null) {
          e.detail.setMode("disabled");
        }
      };
      tracks.addEventListener("mode-change", onModeChange);
      const already = tracks.selected;
      if (already && already.mode === "showing") already.mode = "disabled";
      capUnsub.current = () =>
        tracks.removeEventListener("mode-change", onModeChange);

      unsub.current = player.subscribe((state) => {
        const duration = state.duration;
        const position = state.currentTime;
        if (!(duration > 0) || !Number.isFinite(duration)) return;
        latest.current = { position, duration };

        // Resume once, as soon as we know the duration — unless the learner
        // effectively finished already, in which case start from the top.
        if (!resumed.current) {
          resumed.current = true;
          const at = cfg.current.resumeAt ?? 0;
          if (at > 2 && at < duration * COMPLETE_AT) {
            resumedPos.current = at;
            lastSavedSec.current = Math.floor(at);
            // Seed latest so an immediate save (before the seek reflects in
            // state) reports the resume point, not the pre-seek 0.
            latest.current = { position: at, duration };
            player.currentTime = at;
          } else {
            resumedPos.current = 0;
          }
          return; // don't run save/complete on the tick we resume
        }

        // Completion — fire once at ≥95% watched or on `ended`.
        if (!completed.current && (state.ended || position / duration >= COMPLETE_AT)) {
          completed.current = true;
          save(false, true);
          cfg.current.onComplete?.();
          return;
        }

        // Throttled periodic save while playing.
        const sec = Math.floor(position);
        if (cfg.current.videoId && Math.abs(sec - lastSavedSec.current) >= SAVE_EVERY) {
          lastSavedSec.current = sec;
          save(false);
        }
      });
    },
    [controls, save],
  );

  // Final save when the tab is hidden or unloaded (covers closing/navigating).
  useEffect(() => {
    if (!videoId) return;
    const onHide = () => {
      if (document.visibilityState === "hidden") save(true);
    };
    const onPageHide = () => save(true);
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", onPageHide);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", onPageHide);
    };
  }, [videoId, save]);

  function onProviderChange(provider: MediaProviderAdapter | null) {
    // Use our bundled hls.js instead of Vidstack's default CDN load
    // (our CSP blocks external scripts).
    if (isHLSProvider(provider)) {
      provider.library = HLS;
    }
  }

  return (
    <MediaPlayer
      ref={register}
      title={title}
      src={{ src, type: type as "video/mp4" }}
      playsInline
      autoplay={autoPlay}
      onProviderChange={onProviderChange}
      className="aspect-video w-full overflow-hidden rounded-xl border border-border"
    >
      <MediaProvider />
      {captions && (
        <Track kind="subtitles" src={captions} label="English" language="en" />
      )}
      <DefaultVideoLayout thumbnails={thumbnails} icons={defaultLayoutIcons} />
    </MediaPlayer>
  );
}
