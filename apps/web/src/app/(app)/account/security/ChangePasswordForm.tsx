"use client";

import { useActionState } from "react";
import { changePasswordAction } from "@/server/auth/account-actions";
import type { ChangePasswordState } from "@/server/auth/auth-types";

const initial: ChangePasswordState = {};

export function ChangePasswordForm() {
  const [state, formAction, pending] = useActionState(changePasswordAction, initial);

  return (
    <form action={formAction} className="max-w-sm space-y-4">
      <div>
        <label htmlFor="currentPassword" className="mb-1 block text-sm font-medium text-heading">
          Current password
        </label>
        <input
          id="currentPassword"
          name="currentPassword"
          type="password"
          autoComplete="current-password"
          required
          className="h-10 w-full rounded-lg border border-border bg-canvas px-4 text-body-md text-heading focus:border-indigo focus:outline-none focus:ring-2 focus:ring-indigo/20"
        />
      </div>
      <div>
        <label htmlFor="newPassword" className="mb-1 block text-sm font-medium text-heading">
          New password
        </label>
        <input
          id="newPassword"
          name="newPassword"
          type="password"
          autoComplete="new-password"
          required
          minLength={12}
          className="h-10 w-full rounded-lg border border-border bg-canvas px-4 text-body-md text-heading focus:border-indigo focus:outline-none focus:ring-2 focus:ring-indigo/20"
        />
      </div>
      <div>
        <label htmlFor="confirm" className="mb-1 block text-sm font-medium text-heading">
          Confirm new password
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
      {state.success && <p className="text-sm text-success">{state.success}</p>}

      <button
        type="submit"
        disabled={pending}
        className="h-10 rounded-lg bg-slate px-4 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        {pending ? "Updating…" : "Update password"}
      </button>
    </form>
  );
}
