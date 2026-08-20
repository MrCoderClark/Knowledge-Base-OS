import { AlertTriangle, BarChart3, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { can, getActor } from "@/server/authz";
import { courseAnalytics, orgSummary } from "@/server/kb/analytics";

function Stat({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "danger" | "success";
}) {
  const color =
    tone === "danger"
      ? "text-danger"
      : tone === "success"
        ? "text-success"
        : "text-heading";
  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      <div className="text-sm font-medium text-body">{label}</div>
      <div className={`mt-2 text-3xl font-bold ${color}`}>{value}</div>
    </div>
  );
}

export default async function AnalyticsPage() {
  const actor = await getActor();
  if (!actor) redirect("/signin");
  if (!can(actor, "analytics:read")) redirect("/");

  const rows = await courseAnalytics(actor.orgId);
  const summary = orgSummary(rows);
  const required = rows.filter((r) => r.required);

  return (
    <div className="mx-auto max-w-[1200px] px-8 py-8">
      <header className="mb-8">
        <h1 className="flex items-center gap-2 text-[32px] font-semibold leading-tight tracking-tight text-heading">
          <BarChart3 className="size-7 text-indigo" />
          Training Analytics
        </h1>
        <p className="mt-1 text-body-lg text-body">
          Enrollment, completion, and compliance across your training.
        </p>
      </header>

      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Compliance rate"
          value={`${summary.complianceRate}%`}
          tone="success"
        />
        <Stat label="Required courses" value={String(summary.requiredCourses)} />
        <Stat
          label="Completed enrollments"
          value={`${summary.completedEnrollments}/${summary.totalEnrollments}`}
        />
        <Stat
          label="Overdue"
          value={String(summary.overdueEnrollments)}
          tone={summary.overdueEnrollments > 0 ? "danger" : "default"}
        />
      </div>

      {/* Compliance (required training) */}
      <section className="mb-10">
        <h2 className="mb-3 flex items-center gap-2 text-xl font-semibold text-heading">
          <ShieldCheck className="size-5 text-success" />
          Required training compliance
        </h2>
        {required.length === 0 ? (
          <p className="rounded-xl border border-border bg-surface px-6 py-10 text-center text-sm text-body">
            No courses are marked required yet. Mark a course required on its edit
            page to track compliance.
          </p>
        ) : (
          <CourseTable rows={required} />
        )}
      </section>

      {/* All courses */}
      <section>
        <h2 className="mb-3 text-xl font-semibold text-heading">All courses</h2>
        {rows.length === 0 ? (
          <p className="rounded-xl border border-border bg-surface px-6 py-10 text-center text-sm text-body">
            No courses yet.
          </p>
        ) : (
          <CourseTable rows={rows} />
        )}
      </section>
    </div>
  );
}

function CourseTable({
  rows,
}: {
  rows: Awaited<ReturnType<typeof courseAnalytics>>;
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-surface">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead>
          <tr className="border-b border-border text-xs font-semibold uppercase tracking-wider text-muted">
            <th className="px-5 py-3">Course</th>
            <th className="px-5 py-3">Enrolled</th>
            <th className="px-5 py-3">Completed</th>
            <th className="px-5 py-3">Rate</th>
            <th className="px-5 py-3">Overdue</th>
            <th className="px-5 py-3 text-right">Details</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.courseId} className="border-t border-border">
              <td className="px-5 py-3">
                <span className="font-medium text-heading">{r.title}</span>
                {r.required && (
                  <span className="ml-2 rounded-md bg-indigo-soft px-1.5 py-0.5 text-xs font-semibold text-indigo">
                    Required
                  </span>
                )}
              </td>
              <td className="px-5 py-3 text-body">{r.enrolled}</td>
              <td className="px-5 py-3 text-body">{r.completed}</td>
              <td className="px-5 py-3">
                <span className="inline-flex items-center gap-2">
                  <span className="h-1.5 w-16 overflow-hidden rounded-full bg-nav-active">
                    <span
                      className="block h-full rounded-full bg-indigo"
                      style={{ width: `${r.completionRate}%` }}
                    />
                  </span>
                  <span className="text-body">{r.completionRate}%</span>
                </span>
              </td>
              <td className="px-5 py-3">
                {r.overdue > 0 ? (
                  <span className="inline-flex items-center gap-1 font-medium text-danger">
                    <AlertTriangle className="size-3.5" />
                    {r.overdue}
                  </span>
                ) : (
                  <span className="text-muted">0</span>
                )}
              </td>
              <td className="px-5 py-3 text-right">
                <Link
                  href={`/analytics/${r.courseId}`}
                  className="font-medium text-indigo hover:underline"
                >
                  Learners
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
