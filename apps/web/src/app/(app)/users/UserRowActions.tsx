"use client";

import { useState, useTransition } from "react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import {
  reactivateUserAction,
  removeUserAction,
  suspendUserAction,
  unlockUserAction,
} from "@/server/kb/user-actions";

type Props = {
  userId: string;
  name: string;
  isSelf: boolean;
  status: "invited" | "active" | "suspended";
  locked: boolean;
};

const btn =
  "inline-flex h-7 items-center rounded-md border border-border px-2.5 text-xs font-medium text-body hover:border-border-strong disabled:opacity-50";

export function UserRowActions({ userId, name, isSelf, status, locked }: Props) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(action: () => Promise<{ ok?: true; error?: string }>) {
    setError(null);
    startTransition(async () => {
      const res = await action();
      if (res.error) setError(res.error);
    });
  }

  if (isSelf) {
    return <span className="text-xs text-muted">You</span>;
  }

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {locked && (
        <button
          type="button"
          disabled={pending}
          onClick={() => run(() => unlockUserAction(userId))}
          className={`${btn} text-indigo hover:border-indigo`}
        >
          Unlock
        </button>
      )}

      {status === "suspended" ? (
        <button
          type="button"
          disabled={pending}
          onClick={() => run(() => reactivateUserAction(userId))}
          className={`${btn} text-success hover:border-success`}
        >
          Reactivate
        </button>
      ) : (
        <ConfirmDialog
          title={`Suspend ${name}?`}
          description="They will be signed out immediately and blocked from signing in until reactivated."
          confirmLabel="Suspend"
          onConfirm={() => run(() => suspendUserAction(userId))}
          trigger={
            <button type="button" disabled={pending} className={btn}>
              Suspend
            </button>
          }
        />
      )}

      <ConfirmDialog
        title={`Remove ${name}?`}
        description="They lose access to this organization and are signed out. Content they created is preserved."
        confirmLabel="Remove"
        onConfirm={() => run(() => removeUserAction(userId))}
        trigger={
          <button
            type="button"
            disabled={pending}
            className={`${btn} text-danger hover:border-danger`}
          >
            Remove
          </button>
        }
      />

      {error && <span className="w-full text-right text-xs text-danger">{error}</span>}
    </div>
  );
}
