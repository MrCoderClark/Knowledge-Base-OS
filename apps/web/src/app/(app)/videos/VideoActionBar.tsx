"use client";

import { Bookmark, Download, Share2, ThumbsUp } from "lucide-react";
import { useState } from "react";

/**
 * Like/Save are local, non-persistent toggles for now (a real bookmarks/likes
 * feature is future work). Share copies the page link; Download fetches the file.
 */
export function VideoActionBar({ id }: { id: string }) {
  const [liked, setLiked] = useState(false);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);

  function share() {
    void navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  const base =
    "flex h-9 items-center gap-2 rounded-lg border px-3 text-sm font-medium transition-colors";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => setLiked((v) => !v)}
        className={`${base} ${liked ? "border-indigo bg-indigo-soft text-indigo" : "border-border text-body hover:border-border-strong"}`}
      >
        <ThumbsUp className="size-4" />
        Like
      </button>
      <button
        type="button"
        onClick={() => setSaved((v) => !v)}
        className={`${base} ${saved ? "border-indigo bg-indigo-soft text-indigo" : "border-border text-body hover:border-border-strong"}`}
      >
        <Bookmark className="size-4" />
        {saved ? "Saved" : "Save"}
      </button>
      <button type="button" onClick={share} className={`${base} border-border text-body hover:border-border-strong`}>
        <Share2 className="size-4" />
        {copied ? "Copied!" : "Share"}
      </button>
      <a
        href={`/api/videos/${id}/file?download=1`}
        className={`${base} border-border text-body hover:border-border-strong`}
        aria-label="Download"
      >
        <Download className="size-4" />
      </a>
    </div>
  );
}
