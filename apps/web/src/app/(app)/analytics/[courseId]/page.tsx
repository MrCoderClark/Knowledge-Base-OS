import { ArrowLeft, Download } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { can, getActor } from "@/server/authz";
import { getCourseMeta, learnerProgress } from "@/server/kb/analytics";

function fmtDate(d: Date | null): string {
  return d
    ? d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "—";
}

export default async function CourseLearnersPage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const { courseId } = await params;
  const actor = await getActor();
  if (!actor) redirect("/signin");
  if (!can(actor, "analytics:read")) redirect("/");

  const course = await getCourseMeta(actor.orgId, courseId);
  if (!course) notFound();

  const learners = await learnerProgress(courseId);

  return (
    <div className="mx-auto max-w-[1200px] px-8 py-8">
      <Link
        href="/analytics"
        className="mb-3 inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted hover:text-slate"
      >
        <ArrowLeft className="size-3.5" />
        Back to analytics
      </Link>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[32px] font-semibold leading-tight tracking-tight text-heading">
            {course.title}
          </h1>
          <p className="mt-1 text-body">
            {learners.length} learner{learners.length === 1 ? "" : "s"}
          </p>
        </div>
        <a
          href={`/api/analytics/courses/${courseId}/csv`}
          className="inline-flex h-10 items-center gap-2 rounded-lg border border-border px-4 text-sm font-medium text-body hover:border-border-strong hover:text-slate"
        >
          <Download className="size-4" />
          Export CSV
        </a>
      </div>

      {learners.length === 0 ? (
        <p className="rounded-xl border border-border bg-surface px-6 py-16 text-center text-sm text-body">
          No one is enrolled in this course yet.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-surface">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs font-semibold uppercase tracking-wider text-muted">
                <th className="px-5 py-3">Learner</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Progress</th>
                <th className="px-5 py-3">Due</th>
                <th className="px-5 py-3">Completed</th>
              </tr>
            </thead>
            <tbody>
              {learners.map((l) => {
                const overdue = l.overdue;
                return (
                  <tr key={l.userId} className="border-t border-border">
                    <td className="px-5 py-3">
                      <div className="font-medium text-heading">
                        {l.name ?? l.email}
                      </div>
                      {l.name && (
                        <div className="text-xs text-muted">{l.email}</div>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      {l.status === "completed" ? (
                        <span className="rounded-md bg-green-50 px-2 py-0.5 text-xs font-semibold text-success">
                          Completed
                        </span>
                      ) : overdue ? (
                        <span className="rounded-md bg-red-50 px-2 py-0.5 text-xs font-semibold text-danger">
                          Overdue
                        </span>
                      ) : (
                        <span className="rounded-md bg-nav-active px-2 py-0.5 text-xs font-semibold text-body">
                          Enrolled
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <span className="inline-flex items-center gap-2">
                        <span className="h-1.5 w-20 overflow-hidden rounded-full bg-nav-active">
                          <span
                            className="block h-full rounded-full bg-indigo"
                            style={{ width: `${l.pct}%` }}
                          />
                        </span>
                        <span className="text-body">
                          {l.doneLessons}/{l.totalLessons}
                        </span>
                      </span>
                    </td>
                    <td className="px-5 py-3 text-body">{fmtDate(l.dueAt)}</td>
                    <td className="px-5 py-3 text-body">
                      {fmtDate(l.completedAt)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
