"use client";

import "@vidstack/react/player/styles/default/theme.css";
import "@vidstack/react/player/styles/default/layouts/video.css";

import HLS from "hls.js";
import {
  isHLSProvider,
  MediaPlayer,
  MediaProvider,
  type MediaProviderAdapter,
} from "@vidstack/react";
import {
  DefaultVideoLayout,
  defaultLayoutIcons,
} from "@vidstack/react/player/layouts/default";

type Props = {
  src: string;
  /** e.g. "application/vnd.apple.mpegurl" for HLS, "video/mp4" otherwise. */
  type: string;
  title: string;
};

export function VideoPlayer({ src, type, title }: Props) {
  function onProviderChange(provider: MediaProviderAdapter | null) {
    // Use our bundled hls.js instead of Vidstack's default CDN load
    // (our CSP blocks external scripts).
    if (isHLSProvider(provider)) {
      provider.library = HLS;
    }
  }

  return (
    <MediaPlayer
      title={title}
      src={{ src, type: type as "video/mp4" }}
      playsInline
      onProviderChange={onProviderChange}
      className="aspect-video w-full overflow-hidden rounded-xl border border-border"
    >
      <MediaProvider />
      <DefaultVideoLayout icons={defaultLayoutIcons} />
    </MediaPlayer>
  );
}
