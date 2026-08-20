"use client";

import { Award, GraduationCap } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

export type LearningCard = {
  courseId: string;
  title: string;
  status: "enrolled" | "completed";
  assigned: boolean;
  dueAt: Date | string | null;
  coursePct: number;
  started: boolean;
  doneLessons: number;
  totalLessons: number;
  resumeLessonId: string | null;
  certificateCode: string | null;
};

type TabKey = "in-progress" | "assigned" | "completed" | "overdue";

function isOverdue(c: LearningCard): boolean {
  return (
    c.status === "enrolled" && c.dueAt != null && new Date(c.dueAt) < new Date()
  );
}

const FILTERS: Record<TabKey, (c: LearningCard) => boolean> = {
  "in-progress": (c) =>
    c.status === "enrolled" && c.started && c.coursePct < 100,
  assigned: (c) => c.assigned && c.status !== "completed",
  completed: (c) => c.status === "completed",
  overdue: isOverdue,
};

const TAB_LABELS: { key: TabKey; label: string }[] = [
  { key: "in-progress", label: "In progress" },
  { key: "assigned", label: "Assigned" },
  { key: "overdue", label: "Overdue" },
  { key: "completed", label: "Completed" },
];

function fmtDate(value: Date | string): string {
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function CourseRow({ c }: { c: LearningCard }) {
  const overdue = isOverdue(c);
  const href =
    c.status === "completed" || !c.resumeLessonId
      ? `/courses/${c.courseId}`
      : `/courses/${c.courseId}?lesson=${c.resumeLessonId}`;
  const cta =
    c.status === "completed"
      ? "Review"
      : c.coursePct > 0
        ? "Continue"
        : "Start";

  return (
    <div className="flex items-center gap-4 rounded-xl border border-border bg-surface p-4 transition-colors hover:border-border-strong">
      <div className="flex size-14 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-soft to-nav-active text-indigo">
        <GraduationCap className="size-6" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={href}
            className="font-semibold text-heading hover:text-indigo"
          >
            {c.title}
          </Link>
          {c.assigned && (
            <span className="rounded-md bg-indigo-soft px-2 py-0.5 text-xs font-semibold text-indigo">
              Assigned
            </span>
          )}
          {c.dueAt && (
            <span
              className={`rounded-md px-2 py-0.5 text-xs font-semibold ${
                overdue ? "bg-red-50 text-danger" : "bg-nav-active text-body"
              }`}
            >
              {overdue ? "Overdue · " : "Due "}
              {fmtDate(c.dueAt)}
            </span>
          )}
        </div>
        <div className="mt-2 flex items-center gap-3">
          <div className="h-1.5 w-40 overflow-hidden rounded-full bg-nav-active">
            <div
              className="h-full rounded-full bg-indigo"
              style={{ width: `${c.coursePct}%` }}
            />
          </div>
          <span className="text-xs text-muted">
            {c.doneLessons}/{c.totalLessons} lessons
          </span>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {c.status === "completed" && c.certificateCode && (
          <Link
            href={`/verify/${c.certificateCode}`}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-medium text-body hover:border-border-strong hover:text-slate"
          >
            <Award className="size-4" />
            Certificate
          </Link>
        )}
        <Link
          href={href}
          className="rounded-lg bg-slate px-4 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          {cta}
        </Link>
      </div>
    </div>
  );
}

export function MyLearningTabs({ cards }: { cards: LearningCard[] }) {
  const [tab, setTab] = useState<TabKey>("in-progress");
  const counts = Object.fromEntries(
    TAB_LABELS.map((t) => [t.key, cards.filter(FILTERS[t.key]).length]),
  ) as Record<TabKey, number>;
  const visible = cards.filter(FILTERS[tab]);

  return (
    <div>
      <div className="mb-6 flex gap-1 border-b border-border">
        {TAB_LABELS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
              tab === t.key
                ? "border-indigo text-indigo"
                : "border-transparent text-body hover:text-slate"
            }`}
          >
            {t.label}
            {counts[t.key] > 0 && (
              <span className="ml-1.5 rounded-full bg-nav-active px-1.5 py-0.5 text-xs text-muted">
                {counts[t.key]}
              </span>
            )}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <p className="rounded-xl border border-border bg-surface px-6 py-16 text-center text-sm text-body">
          Nothing here yet.
        </p>
      ) : (
        <div className="space-y-3">
          {visible.map((c) => (
            <CourseRow key={c.courseId} c={c} />
          ))}
        </div>
      )}
    </div>
  );
}
