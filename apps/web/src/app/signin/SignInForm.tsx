"use client";

import Link from "next/link";
import { useActionState } from "react";
import { loginAction } from "@/server/auth/actions";
import type { LoginState } from "@/server/auth/auth-types";

const initialState: LoginState = {};

export function SignInForm({ resetDone = false }: { resetDone?: boolean }) {
  const [state, formAction, pending] = useActionState(loginAction, initialState);

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

        <h1 className="text-xl font-semibold text-heading">Sign in</h1>
        <p className="mb-6 mt-1 text-sm text-body">
          Use the credentials provided by your administrator.
        </p>

        {resetDone && (
          <p className="mb-4 rounded-md bg-green-50 px-3 py-2 text-sm text-success">
            Your password was updated. Please sign in.
          </p>
        )}

        <form action={formAction} className="space-y-4">
          <div>
            <label htmlFor="email" className="mb-1 block text-sm font-medium text-heading">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="username"
              required
              className="h-10 w-full rounded-lg border border-border bg-canvas px-4 text-body-md text-heading placeholder:text-muted focus:border-indigo focus:outline-none focus:ring-2 focus:ring-indigo/20"
            />
          </div>
          <div>
            <label htmlFor="password" className="mb-1 block text-sm font-medium text-heading">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              className="h-10 w-full rounded-lg border border-border bg-canvas px-4 text-body-md text-heading placeholder:text-muted focus:border-indigo focus:outline-none focus:ring-2 focus:ring-indigo/20"
            />
          </div>

          <label className="flex items-center gap-2 text-sm text-body">
            <input
              name="rememberMe"
              type="checkbox"
              className="size-4 rounded border-border text-indigo focus:ring-indigo/20"
            />
            Remember me for 30 days
          </label>

          {state.error && <p className="text-sm text-danger">{state.error}</p>}

          <button
            type="submit"
            disabled={pending}
            className="h-10 w-full rounded-lg bg-slate text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {pending ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <p className="mt-4 text-center text-sm">
          <Link
            href="/forgot-password"
            className="font-medium text-indigo hover:underline"
          >
            Forgot password?
          </Link>
        </p>
      </div>
    </div>
  );
}
