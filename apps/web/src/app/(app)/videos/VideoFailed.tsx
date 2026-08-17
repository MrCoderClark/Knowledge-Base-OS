"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { retryVideoAction } from "@/server/kb/video-actions";

type Props = { id: string; error: string | null; canRetry: boolean };

export function VideoFailed({ id, error, canRetry }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex aspect-video w-full flex-col items-center justify-center gap-3 rounded-xl border border-border bg-surface px-6 text-center">
      <p className="text-sm font-medium text-danger">Processing failed</p>
      {error && <p className="max-w-md text-xs text-muted">{error}</p>}
      {canRetry && (
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              await retryVideoAction(id);
              router.refresh();
            })
          }
          className="h-9 rounded-lg bg-slate px-4 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
        >
          {pending ? "Retrying…" : "Retry"}
        </button>
      )}
    </div>
  );
}
