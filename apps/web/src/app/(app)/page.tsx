import type { LucideIcon } from "lucide-react";
import {
  FilePlus2,
  FileText,
  GraduationCap,
  LayersIcon,
  Users,
  Video,
  VideoIcon,
} from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getActor } from "@/server/authz";
import {
  dashboardStats,
  recentActivity,
  recentlyAdded,
} from "@/server/kb/dashboard";
import { continueLearning } from "@/server/kb/progress";

const quickActions: { label: string; icon: LucideIcon; href: string }[] = [
  { label: "Upload Document", icon: FilePlus2, href: "/documents/upload" },
  { label: "Upload Video", icon: VideoIcon, href: "/videos/upload" },
  { label: "New Course", icon: GraduationCap, href: "/courses/new" },
  { label: "Add Category", icon: LayersIcon, href: "/categories" },
];

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

function ProgressBar({ value }: { value: number }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-nav-active">
      <div className="h-full rounded-full bg-indigo" style={{ width: `${value}%` }} />
    </div>
  );
}

export default async function DashboardPage() {
  const actor = await getActor();
  if (!actor) redirect("/signin");

  const [learning, stats, recent, activity] = await Promise.all([
    continueLearning(actor.orgId, actor.userId),
    dashboardStats(actor.orgId),
    recentlyAdded(actor.orgId),
    recentActivity(actor.orgId),
  ]);
  const firstName = actor.name?.split(" ")[0] ?? "there";

  const statCards: { label: string; value: number; icon: LucideIcon; note: string }[] =
    [
      {
        label: "Total Knowledge Items",
        value: stats.documents + stats.videos,
        icon: FileText,
        note: `${stats.courses} course${stats.courses === 1 ? "" : "s"}`,
      },
      {
        label: "Documents",
        value: stats.documents,
        icon: FileText,
        note: `${stats.docsThisWeek} added this week`,
      },
      {
        label: "Videos",
        value: stats.videos,
        icon: Video,
        note: `${stats.videosThisWeek} added this week`,
      },
      {
        label: "Active Users",
        value: stats.activeUsers,
        icon: Users,
        note: "in your organization",
      },
    ];

  return (
    <div className="mx-auto max-w-[1200px] px-8 py-8">
      {/* Greeting */}
      <header className="mb-8">
        <h1 className="text-[32px] font-semibold leading-tight tracking-tight text-heading">
          Welcome back, {firstName}
        </h1>
        <p className="mt-1 text-body-lg text-body">
          Here&apos;s what&apos;s happening across your knowledge base.
        </p>
      </header>

      {/* Quick actions */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {quickActions.map((a) => {
          const Icon = a.icon;
          return (
            <Link
              key={a.label}
              href={a.href}
              className="flex flex-col items-center gap-3 rounded-xl border border-border bg-surface p-6 text-center transition-colors hover:border-border-strong"
            >
              <span className="flex size-11 items-center justify-center rounded-full bg-indigo-soft text-indigo">
                <Icon className="size-5" strokeWidth={2} />
              </span>
              <span className="text-body-md font-medium text-heading">
                {a.label}
              </span>
            </Link>
          );
        })}
      </div>

      {/* Stats */}
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((s) => {
          const Icon = s.icon;
          return (
            <Card key={s.label} className="p-5">
              <div className="flex items-start justify-between">
                <span className="text-sm font-medium text-body">{s.label}</span>
                <Icon className="size-4 text-muted" />
              </div>
              <div className="mt-3 text-3xl font-bold text-heading">
                {s.value.toLocaleString()}
              </div>
              <div className="mt-2 text-sm text-muted">{s.note}</div>
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
                href="/my-learning"
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
              <Link
                href="/knowledge-base"
                className="text-sm font-medium text-indigo hover:underline"
              >
                Browse all
              </Link>
            </div>
            {recent.length === 0 ? (
              <Card className="p-6 text-center text-sm text-body">
                Nothing added yet.
              </Card>
            ) : (
              <Card className="overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[520px] text-left text-sm">
                    <thead>
                      <tr className="border-b border-border text-xs font-semibold uppercase tracking-wider text-muted">
                        <th className="px-5 py-3">Content</th>
                        <th className="px-5 py-3">Type</th>
                        <th className="px-5 py-3">Category</th>
                        <th className="px-5 py-3">Added</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recent.map((r, i) => (
                        <tr key={r.href} className={i > 0 ? "border-t border-border" : ""}>
                          <td className="px-5 py-3 font-medium text-heading">
                            <Link href={r.href} className="hover:text-indigo">
                              {r.title}
                            </Link>
                          </td>
                          <td className="px-5 py-3">
                            <span className="inline-flex items-center rounded-md bg-indigo-soft px-2 py-0.5 text-xs font-semibold text-indigo">
                              {r.type}
                            </span>
                          </td>
                          <td className="px-5 py-3 text-body">
                            {r.categoryName ?? "—"}
                          </td>
                          <td className="px-5 py-3 text-body">{r.dateLabel}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}
          </section>
        </div>

        {/* Activity column */}
        <section>
          <Card className="p-5">
            <h2 className="mb-4 text-xl font-semibold text-heading">Recent Activity</h2>
            {activity.length === 0 ? (
              <p className="text-sm text-muted">No recent activity.</p>
            ) : (
              <ol className="space-y-5">
                {activity.map((a) => (
                  <li key={`${a.href}-${a.whenLabel}`} className="flex gap-3">
                    <span className="mt-1 size-2 shrink-0 rounded-full border-2 border-indigo" />
                    <div className="min-w-0">
                      <p className="text-sm text-body">
                        <span className="font-semibold text-heading">{a.who}</span>{" "}
                        {a.verb}{" "}
                        <Link href={a.href} className="font-medium text-indigo hover:underline">
                          {a.target}
                        </Link>
                      </p>
                      <p className="mt-1 text-xs text-muted">{a.whenLabel}</p>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </Card>
        </section>
      </div>
    </div>
  );
}
