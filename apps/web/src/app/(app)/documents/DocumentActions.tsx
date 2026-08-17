"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import {
  deleteDocumentAction,
  publishDocumentAction,
} from "@/server/kb/document-actions";

type Props = {
  id: string;
  status: string;
  canEdit: boolean;
  canPublish: boolean;
  canDelete: boolean;
};

export function DocumentActions({
  id,
  status,
  canEdit,
  canPublish,
  canDelete,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex items-center gap-3">
      {canEdit && (
        <Link
          href={`/documents/${id}/edit`}
          className="flex h-9 items-center rounded-lg border border-border px-3 text-sm font-medium text-body hover:border-border-strong hover:text-slate"
        >
          Edit
        </Link>
      )}
      {canPublish && status === "draft" && (
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              await publishDocumentAction(id);
              router.refresh();
            })
          }
          className="h-9 rounded-lg bg-slate px-3 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
        >
          {pending ? "Publishing…" : "Publish"}
        </button>
      )}
      {canDelete && (
        <ConfirmDialog
          title="Delete document?"
          description="This document will be permanently removed. This can't be undone."
          confirmLabel="Delete"
          onConfirm={async () => {
            await deleteDocumentAction(id);
            router.push("/documents");
          }}
          trigger={
            <button
              type="button"
              className="text-sm font-medium text-danger hover:underline"
            >
              Delete
            </button>
          }
        />
      )}
    </div>
  );
}
