import type { LucideIcon } from "lucide-react";
import {
  ArrowUp,
  FileText,
  FilePlus2,
  FolderPlus,
  GraduationCap,
  LayersIcon,
  MoreHorizontal,
  TrendingUp,
  Users,
  Video,
  VideoIcon,
} from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getActor } from "@/server/authz";
import { continueLearning } from "@/server/kb/progress";

/* ------------------------------------------------------------------ */
/* Mock data — replaced by org-scoped queries once Neon/Drizzle lands. */
/* ------------------------------------------------------------------ */

const quickActions = [
  { label: "Upload Document", icon: FilePlus2 },
  { label: "Upload Video", icon: VideoIcon },
  { label: "Create Collection", icon: FolderPlus },
  { label: "Add Category", icon: LayersIcon },
];

const stats = [
  { label: "Total Knowledge Items", value: "1,248", icon: FileText, delta: "12% this month", trend: true },
  { label: "Documents", value: "936", icon: FileText, note: "24 added this week" },
  { label: "Videos", value: "312", icon: Video, note: "8 new videos" },
  { label: "Active Users", value: "184", icon: Users, delta: "6% this month", trend: true },
];

const recentlyAdded = [
  { content: "Q3 Marketing Guidelines", type: "Doc", category: "Marketing", date: "Today" },
  { content: "API Documentation", type: "Doc", category: "Engineering", date: "Yesterday" },
  { content: "Safety Training v2", type: "Video", category: "Operations", date: "2 days ago" },
];

const activity = [
  { who: "Sarah Jenkins", verb: "published", target: "Q3 Marketing Guidelines", when: "2 hours ago" },
  { who: "Marcus Chen", verb: "updated", target: "API Documentation", when: "4 hours ago" },
  {
    who: "Elena Rodriguez",
    verb: "commented on",
    target: "Employee Benefits 2024",
    when: "Yesterday",
    comment:
      "Please review section 4 regarding the new flexible working hours.",
  },
];

/* ------------------------------------------------------------------ */
/* Primitives                                                          */
/* ------------------------------------------------------------------ */

function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-xl border border-border bg-surface transition-colors hover:border-border-strong ${className}`}
    >
      {children}
    </div>
  );
}

function QuickAction({ label, icon: Icon }: { label: string; icon: LucideIcon }) {
  return (
    <button className="flex flex-col items-center gap-3 rounded-xl border border-border bg-surface p-6 text-center transition-colors hover:border-border-strong">
      <span className="flex size-11 items-center justify-center rounded-full bg-indigo-soft text-indigo">
        <Icon className="size-5" strokeWidth={2} />
      </span>
      <span className="text-body-md font-medium text-heading">{label}</span>
    </button>
  );
}

function ProgressBar({ value }: { value: number }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-nav-active">
      <div className="h-full rounded-full bg-indigo" style={{ width: `${value}%` }} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default async function DashboardPage() {
  const actor = await getActor();
  if (!actor) redirect("/signin");

  const learning = await continueLearning(actor.orgId, actor.userId);
  const firstName = actor.name?.split(" ")[0] ?? "there";

  return (
    <div className="mx-auto max-w-[1200px] px-8 py-8">
      {/* Greeting */}
      <header className="mb-8">
        <h1 className="text-[32px] font-semibold leading-tight tracking-tight text-heading">
          Good morning, {firstName}
        </h1>
        <p className="mt-1 text-body-lg text-body">
          Here&apos;s what&apos;s happening across your knowledge base.
        </p>
      </header>

      {/* Quick actions */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {quickActions.map((a) => (
          <QuickAction key={a.label} label={a.label} icon={a.icon} />
        ))}
      </div>

      {/* Stats */}
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <Card key={s.label} className="p-5">
              <div className="flex items-start justify-between">
                <span className="text-sm font-medium text-body">{s.label}</span>
                <Icon className="size-4 text-muted" />
              </div>
              <div className="mt-3 text-3xl font-bold text-heading">{s.value}</div>
              {s.trend ? (
                <div className="mt-2 flex items-center gap-1 text-sm font-medium text-success">
                  <ArrowUp className="size-3.5" strokeWidth={2.5} />
                  {s.delta}
                </div>
              ) : (
                <div className="mt-2 text-sm text-muted">{s.note}</div>
              )}
            </Card>
          );
        })}
      </div>

      {/* Two-column: main + activity */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Main column */}
        <div className="space-y-8 lg:col-span-2">
          {/* Continue learning */}
          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-heading">Continue Learning</h2>
              <Link
                href="/courses"
                className="text-sm font-medium text-indigo hover:underline"
              >
                View All
              </Link>
            </div>
            {learning.length === 0 ? (
              <Card className="p-6 text-center text-sm text-body">
                No courses in progress.{" "}
                <Link href="/courses" className="font-medium text-indigo hover:underline">
                  Browse training
                </Link>
                .
              </Card>
            ) : (
              <div className="space-y-3">
                {learning.map((c) => (
                  <Link
                    key={c.courseId}
                    href={`/courses/${c.courseId}?lesson=${c.resumeLessonId}`}
                    className="block"
                  >
                    <Card className="flex items-center gap-4 p-4">
                      <div className="flex size-16 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-soft to-nav-active text-indigo">
                        <GraduationCap className="size-7" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold text-heading">{c.title}</div>
                        <div className="mb-2 truncate text-sm text-body">
                          Up next: {c.subtitle}
                        </div>
                        <ProgressBar value={c.coursePct} />
                      </div>
                      <div className="text-sm font-medium text-body">{c.coursePct}%</div>
                    </Card>
                  </Link>
                ))}
              </div>
            )}
          </section>

          {/* Recently added */}
          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-heading">Recently Added</h2>
              <button aria-label="More" className="rounded-md p-1 text-muted hover:bg-nav-active">
                <MoreHorizontal className="size-5" />
              </button>
            </div>
            <Card className="overflow-hidden">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-xs font-semibold uppercase tracking-wider text-muted">
                    <th className="px-5 py-3">Content</th>
                    <th className="px-5 py-3">Type</th>
                    <th className="px-5 py-3">Category</th>
                    <th className="px-5 py-3">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {recentlyAdded.map((r, i) => (
                    <tr key={r.content} className={i > 0 ? "border-t border-border" : ""}>
                      <td className="px-5 py-3 font-medium text-heading">{r.content}</td>
                      <td className="px-5 py-3">
                        <span className="inline-flex items-center rounded-md bg-indigo-soft px-2 py-0.5 text-xs font-semibold text-indigo">
                          {r.type}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-body">{r.category}</td>
                      <td className="px-5 py-3 text-body">{r.date}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          </section>
        </div>

        {/* Activity column */}
        <section>
          <Card className="p-5">
            <h2 className="mb-4 text-xl font-semibold text-heading">Recent Activity</h2>
            <ol className="space-y-5">
              {activity.map((a) => (
                <li key={a.target} className="flex gap-3">
                  <span className="mt-1 size-2 shrink-0 rounded-full border-2 border-indigo" />
                  <div className="min-w-0">
                    <p className="text-sm text-body">
                      <span className="font-semibold text-heading">{a.who}</span> {a.verb}{" "}
                      <span className="font-medium text-indigo">{a.target}</span>
                    </p>
                    {a.comment && (
                      <p className="mt-2 rounded-md bg-canvas p-3 text-sm italic text-body">
                        “{a.comment}”
                      </p>
                    )}
                    <p className="mt-1 text-xs text-muted">{a.when}</p>
                  </div>
                </li>
              ))}
            </ol>
          </Card>
        </section>
      </div>

      {/* Growth marker — remove once real analytics land */}
      <div className="mt-10 flex items-center gap-2 text-xs text-muted">
        <TrendingUp className="size-3.5" />
        Phase 0 shell · mock data
      </div>
    </div>
  );
}
