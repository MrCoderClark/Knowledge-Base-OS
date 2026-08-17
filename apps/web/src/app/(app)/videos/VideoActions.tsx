"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { deleteVideoAction } from "@/server/kb/video-actions";

type Props = { id: string; canEdit: boolean; canDelete: boolean };

export function VideoActions({ id, canEdit, canDelete }: Props) {
  const router = useRouter();
  if (!canEdit && !canDelete) return null;

  return (
    <div className="flex items-center gap-3">
      {canEdit && (
        <Link
          href={`/videos/${id}/edit`}
          className="flex h-9 items-center rounded-lg border border-border px-3 text-sm font-medium text-body hover:border-border-strong hover:text-slate"
        >
          Edit
        </Link>
      )}
      {canDelete && (
        <ConfirmDialog
          title="Delete video?"
          description="This video and its file will be permanently removed. This can't be undone."
          confirmLabel="Delete"
          onConfirm={async () => {
            await deleteVideoAction(id);
            router.push("/videos");
          }}
          trigger={
            <button type="button" className="text-sm font-medium text-danger hover:underline">
              Delete
            </button>
          }
        />
      )}
    </div>
  );
}
