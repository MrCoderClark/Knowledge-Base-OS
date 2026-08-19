"use client";

import { Bell, Check, GraduationCap } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  markAllNotificationsReadAction,
  markNotificationReadAction,
} from "@/server/kb/notification-actions";

export type NotificationItem = {
  id: string;
  title: string;
  body: string | null;
  linkUrl: string | null;
  readAt: Date | string | null;
  createdAt: Date | string;
};

function timeAgo(value: Date | string): string {
  const then = new Date(value).getTime();
  const s = Math.max(1, Math.floor((Date.now() - then) / 1000));
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return d === 1 ? "yesterday" : `${d}d ago`;
}

export function NotificationBell({
  items,
  unread,
}: {
  items: NotificationItem[];
  unread: number;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const [, startTransition] = useTransition();

  function markAll() {
    startTransition(async () => {
      await markAllNotificationsReadAction();
      router.refresh();
    });
  }

  function openItem(n: NotificationItem) {
    setOpen(false);
    startTransition(async () => {
      if (!n.readAt) await markNotificationReadAction(n.id);
      if (n.linkUrl) router.push(n.linkUrl);
      router.refresh();
    });
  }

  return (
    <div className="relative">
      <button
        type="button"
        aria-label="Notifications"
        onClick={() => setOpen((v) => !v)}
        className="relative rounded-md p-2 text-body hover:bg-nav-active hover:text-slate"
      >
        <Bell className="size-5" />
        {unread > 0 && (
          <span className="absolute right-1 top-1 flex min-w-4 items-center justify-center rounded-full bg-indigo px-1 text-[10px] font-semibold leading-4 text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <>
          {/* Click-away backdrop */}
          <button
            type="button"
            aria-hidden
            tabIndex={-1}
            className="fixed inset-0 z-40 cursor-default"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 z-50 mt-2 w-80 overflow-hidden rounded-xl border border-border bg-surface shadow-lg">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <span className="text-sm font-semibold text-heading">
                Notifications
              </span>
              {unread > 0 && (
                <button
                  type="button"
                  onClick={markAll}
                  className="inline-flex items-center gap-1 text-xs font-medium text-indigo hover:underline"
                >
                  <Check className="size-3.5" />
                  Mark all read
                </button>
              )}
            </div>
            {items.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-muted">
                You&apos;re all caught up.
              </p>
            ) : (
              <ul className="max-h-96 overflow-y-auto">
                {items.map((n) => (
                  <li key={n.id}>
                    <button
                      type="button"
                      onClick={() => openItem(n)}
                      className={`flex w-full gap-3 border-b border-border px-4 py-3 text-left last:border-0 hover:bg-nav-active ${
                        n.readAt ? "" : "bg-indigo-soft/40"
                      }`}
                    >
                      <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-indigo-soft text-indigo">
                        <GraduationCap className="size-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium text-heading">
                          {n.title}
                        </span>
                        {n.body && (
                          <span className="block text-xs text-body">{n.body}</span>
                        )}
                        <span className="mt-0.5 block text-[11px] text-muted">
                          {timeAgo(n.createdAt)}
                        </span>
                      </span>
                      {!n.readAt && (
                        <span className="mt-1.5 size-2 shrink-0 rounded-full bg-indigo" />
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}
