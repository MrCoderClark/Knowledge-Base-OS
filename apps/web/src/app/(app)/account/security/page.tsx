import { redirect } from "next/navigation";
import {
  revokeOtherSessionsAction,
  revokeSessionAction,
} from "@/server/auth/account-actions";
import { getCurrentSession, listUserSessions } from "@/server/auth/session";
import { ChangePasswordForm } from "./ChangePasswordForm";

function formatDevice(ua: string | null): string {
  if (!ua) return "Unknown device";
  const browser = /Edg/.test(ua)
    ? "Edge"
    : /Chrome/.test(ua)
      ? "Chrome"
      : /Firefox/.test(ua)
        ? "Firefox"
        : /Safari/.test(ua)
          ? "Safari"
          : "Browser";
  const os = /Windows/.test(ua)
    ? "Windows"
    : /Mac OS X/.test(ua)
      ? "macOS"
      : /Android/.test(ua)
        ? "Android"
        : /iPhone|iPad/.test(ua)
          ? "iOS"
          : /Linux/.test(ua)
            ? "Linux"
            : "Unknown OS";
  return `${browser} on ${os}`;
}

function relative(date: Date): string {
  const s = Math.floor((Date.now() - date.getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export default async function AccountSecurityPage() {
  const session = await getCurrentSession();
  if (!session) redirect("/signin");

  const active = await listUserSessions(session.user.id);
  const hasOthers = active.some((s) => s.id !== session.sessionId);

  return (
    <div className="mx-auto max-w-[1200px] px-8 py-8">
      <header className="mb-8">
        <h1 className="text-[32px] font-semibold leading-tight tracking-tight text-heading">
          Account security
        </h1>
        <p className="mt-1 text-body-lg text-body">
          Manage your password and active sessions.
        </p>
      </header>

      <section className="mb-8 rounded-xl border border-border bg-surface p-6">
        <h2 className="mb-1 text-lg font-semibold text-heading">Change password</h2>
        <p className="mb-4 text-sm text-body">
          Changing your password signs out all your other sessions.
        </p>
        <ChangePasswordForm />
      </section>

      <section className="rounded-xl border border-border bg-surface p-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-heading">Active sessions</h2>
            <p className="text-sm text-body">
              Devices currently signed in to your account.
            </p>
          </div>
          {hasOthers && (
            <form action={revokeOtherSessionsAction}>
              <button
                type="submit"
                className="h-9 rounded-lg border border-border bg-surface px-3 text-sm font-medium text-body hover:border-border-strong hover:text-slate"
              >
                Sign out other sessions
              </button>
            </form>
          )}
        </div>

        <ul className="divide-y divide-border">
          {active.map((s) => {
            const isCurrent = s.id === session.sessionId;
            return (
              <li key={s.id} className="flex items-center justify-between py-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-heading">
                      {formatDevice(s.userAgent)}
                    </span>
                    {isCurrent && (
                      <span className="inline-flex items-center rounded-md bg-indigo-soft px-2 py-0.5 text-xs font-semibold text-indigo">
                        This device
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-muted">
                    {s.ip ?? "unknown IP"} · active {relative(s.lastSeenAt)}
                  </div>
                </div>
                {!isCurrent && (
                  <form action={revokeSessionAction}>
                    <input type="hidden" name="sessionId" value={s.id} />
                    <button
                      type="submit"
                      className="text-sm font-medium text-danger hover:underline"
                    >
                      Revoke
                    </button>
                  </form>
                )}
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
