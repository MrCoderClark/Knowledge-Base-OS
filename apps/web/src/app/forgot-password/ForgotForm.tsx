"use client";

import Link from "next/link";
import { useActionState } from "react";
import { forgotPasswordAction } from "@/server/auth/reset-actions";
import type { ForgotState } from "@/server/auth/auth-types";

const initial: ForgotState = {};

export function ForgotForm() {
  const [state, formAction, pending] = useActionState(forgotPasswordAction, initial);

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

        {state.sent ? (
          <>
            <h1 className="text-xl font-semibold text-heading">Check your email</h1>
            <p className="mb-6 mt-1 text-sm text-body">
              If an account exists for that address, we&apos;ve sent a password
              reset link. It expires in 30 minutes.
            </p>
            <Link
              href="/signin"
              className="text-sm font-medium text-indigo hover:underline"
            >
              Back to sign in
            </Link>
          </>
        ) : (
          <>
            <h1 className="text-xl font-semibold text-heading">Forgot password</h1>
            <p className="mb-6 mt-1 text-sm text-body">
              Enter your email and we&apos;ll send you a reset link.
            </p>
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
                  className="h-10 w-full rounded-lg border border-border bg-canvas px-4 text-body-md text-heading focus:border-indigo focus:outline-none focus:ring-2 focus:ring-indigo/20"
                />
              </div>
              <button
                type="submit"
                disabled={pending}
                className="h-10 w-full rounded-lg bg-slate text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60"
              >
                {pending ? "Sending…" : "Send reset link"}
              </button>
            </form>
            <p className="mt-4 text-sm">
              <Link href="/signin" className="font-medium text-indigo hover:underline">
                Back to sign in
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
