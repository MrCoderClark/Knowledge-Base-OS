"use client";

import { useActionState } from "react";
import { inviteUserAction } from "@/server/auth/invite-actions";
import type { InviteState } from "@/server/auth/auth-types";

const initial: InviteState = {};

export function InviteForm() {
  const [state, formAction, pending] = useActionState(inviteUserAction, initial);

  return (
    <div>
      <form
        action={formAction}
        className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end"
      >
        <div className="min-w-[220px] flex-1">
          <label htmlFor="email" className="mb-1 block text-sm font-medium text-heading">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            placeholder="person@company.com"
            className="h-10 w-full rounded-lg border border-border bg-canvas px-4 text-body-md text-heading placeholder:text-muted focus:border-indigo focus:outline-none focus:ring-2 focus:ring-indigo/20"
          />
        </div>
        <div className="min-w-[180px] flex-1">
          <label htmlFor="name" className="mb-1 block text-sm font-medium text-heading">
            Name <span className="text-muted">(optional)</span>
          </label>
          <input
            id="name"
            name="name"
            type="text"
            className="h-10 w-full rounded-lg border border-border bg-canvas px-4 text-body-md text-heading placeholder:text-muted focus:border-indigo focus:outline-none focus:ring-2 focus:ring-indigo/20"
          />
        </div>
        <div>
          <label htmlFor="role" className="mb-1 block text-sm font-medium text-heading">
            Role
          </label>
          <select
            id="role"
            name="role"
            defaultValue="viewer"
            className="h-10 rounded-lg border border-border bg-canvas px-3 text-body-md text-heading focus:border-indigo focus:outline-none focus:ring-2 focus:ring-indigo/20"
          >
            <option value="viewer">Viewer</option>
            <option value="editor">Editor</option>
            <option value="admin">Admin</option>
          </select>
        </div>
        <button
          type="submit"
          disabled={pending}
          className="h-10 shrink-0 rounded-lg bg-slate px-4 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {pending ? "Sending…" : "Send invite"}
        </button>
      </form>

      {state.error && <p className="mt-3 text-sm text-danger">{state.error}</p>}
      {state.success && <p className="mt-3 text-sm text-success">{state.success}</p>}
    </div>
  );
}
