"use client";

import { useActionState } from "react";
import { resetPasswordAction } from "@/server/auth/reset-actions";
import type { ResetState } from "@/server/auth/auth-types";

const initial: ResetState = {};

export function ResetForm({ token }: { token: string }) {
  const [state, formAction, pending] = useActionState(resetPasswordAction, initial);

  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-4">
      <div className="w-full max-w-sm rounded-xl border border-border bg-surface p-8 shadow-overlay">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-lg bg-slate text-sm font-bold text-white">
            K
          </div>
          <div className="leading-tight">
            <div className="text-[15px] font-bold text-heading">KnowledgeOS</div>
            <div className="text-xs text-muted">Enterprise Hub</div>
          </div>
        </div>

        <h1 className="text-xl font-semibold text-heading">Choose a new password</h1>
        <p className="mb-6 mt-1 text-sm text-body">
          At least 12 characters. This signs out all other sessions.
        </p>

        <form action={formAction} className="space-y-4">
          <input type="hidden" name="token" value={token} />
          <div>
            <label htmlFor="password" className="mb-1 block text-sm font-medium text-heading">
              New password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={12}
              className="h-10 w-full rounded-lg border border-border bg-canvas px-4 text-body-md text-heading focus:border-indigo focus:outline-none focus:ring-2 focus:ring-indigo/20"
            />
          </div>
          <div>
            <label htmlFor="confirm" className="mb-1 block text-sm font-medium text-heading">
              Confirm password
            </label>
            <input
              id="confirm"
              name="confirm"
              type="password"
              autoComplete="new-password"
              required
              minLength={12}
              className="h-10 w-full rounded-lg border border-border bg-canvas px-4 text-body-md text-heading focus:border-indigo focus:outline-none focus:ring-2 focus:ring-indigo/20"
            />
          </div>

          {state.error && <p className="text-sm text-danger">{state.error}</p>}

          <button
            type="submit"
            disabled={pending}
            className="h-10 w-full rounded-lg bg-slate text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {pending ? "Updating…" : "Update password"}
          </button>
        </form>
      </div>
    </div>
  );
}
