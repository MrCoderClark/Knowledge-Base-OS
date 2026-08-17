"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Placeholder shown while the pipeline transcodes; auto-refreshes until ready. */
export function VideoProcessing() {
  const router = useRouter();
  useEffect(() => {
    const t = setInterval(() => router.refresh(), 4000);
    return () => clearInterval(t);
  }, [router]);

  return (
    <div className="flex aspect-video w-full flex-col items-center justify-center gap-3 rounded-xl border border-border bg-surface">
      <span className="size-8 animate-spin rounded-full border-2 border-border border-t-indigo" />
      <p className="text-sm font-medium text-heading">Processing video…</p>
      <p className="text-xs text-muted">
        This can take a few minutes. The page updates automatically.
      </p>
    </div>
  );
}
