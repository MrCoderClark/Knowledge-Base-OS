"use client";

import "@vidstack/react/player/styles/default/theme.css";
import "@vidstack/react/player/styles/default/layouts/video.css";

import { MediaPlayer, MediaProvider } from "@vidstack/react";
import {
  DefaultVideoLayout,
  defaultLayoutIcons,
} from "@vidstack/react/player/layouts/default";

type Props = {
  src: string;
  mimeType: string | null;
  title: string;
};

export function VideoPlayer({ src, mimeType, title }: Props) {
  return (
    <MediaPlayer
      title={title}
      // Our file URL has no extension, so give Vidstack the type explicitly.
      src={{ src, type: (mimeType ?? "video/mp4") as "video/mp4" }}
      playsInline
      className="aspect-video w-full overflow-hidden rounded-xl border border-border"
    >
      <MediaProvider />
      <DefaultVideoLayout icons={defaultLayoutIcons} />
    </MediaPlayer>
  );
}
