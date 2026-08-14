"use client";

import * as AlertDialog from "@radix-ui/react-alert-dialog";
import { useTransition } from "react";

type Props = {
  trigger: React.ReactNode;
  title: string;
  description?: string;
  confirmLabel?: string;
  /** Runs on confirm; wrapped in a transition so the trigger shows pending. */
  onConfirm: () => void | Promise<void>;
};

export function ConfirmDialog({
  trigger,
  title,
  description,
  confirmLabel = "Delete",
  onConfirm,
}: Props) {
  const [pending, startTransition] = useTransition();

  return (
    <AlertDialog.Root>
      <AlertDialog.Trigger asChild>{trigger}</AlertDialog.Trigger>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 z-50 bg-slate/40" />
        <AlertDialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border bg-surface p-6 shadow-overlay focus:outline-none">
          <AlertDialog.Title className="text-lg font-semibold text-heading">
            {title}
          </AlertDialog.Title>
          {description && (
            <AlertDialog.Description className="mt-1 text-sm text-body">
              {description}
            </AlertDialog.Description>
          )}
          <div className="mt-6 flex justify-end gap-3">
            <AlertDialog.Cancel asChild>
              <button className="h-9 rounded-lg border border-border px-4 text-sm font-medium text-body hover:border-border-strong">
                Cancel
              </button>
            </AlertDialog.Cancel>
            <AlertDialog.Action asChild>
              <button
                disabled={pending}
                onClick={() => startTransition(async () => { await onConfirm(); })}
                className="h-9 rounded-lg bg-danger px-4 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
              >
                {pending ? "Working…" : confirmLabel}
              </button>
            </AlertDialog.Action>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
