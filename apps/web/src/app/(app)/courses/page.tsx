import { GraduationCap } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getActor, hasPermission } from "@/server/authz";
import { listCourses } from "@/server/kb/courses";

export default async function CoursesPage() {
  const actor = await getActor();
  if (!actor) redirect("/signin");

  const canManage = hasPermission(actor.role, "course:manage");
  const rows = await listCourses(actor.orgId, { includeUnpublished: canManage });

  return (
    <div className="mx-auto max-w-[1200px] px-8 py-8">
      <header className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-[32px] font-semibold leading-tight tracking-tight text-heading">
            Training
          </h1>
          <p className="mt-1 text-body-lg text-body">
            Courses to learn from, built from your videos.
          </p>
        </div>
        {canManage && (
          <Link
            href="/courses/new"
            className="flex h-10 items-center rounded-lg bg-slate px-4 text-sm font-medium text-white hover:opacity-90"
          >
            New Course
          </Link>
        )}
      </header>

      {rows.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface px-6 py-16 text-center text-sm text-body">
          No courses yet.{canManage ? " Create your first one." : ""}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((c) => (
            <Link
              key={c.id}
              href={`/courses/${c.id}`}
              className="group flex flex-col rounded-xl border border-border bg-surface p-5 transition-colors hover:border-border-strong"
            >
              <div className="mb-3 flex items-center justify-between">
                <span className="flex size-10 items-center justify-center rounded-lg bg-indigo-soft text-indigo">
                  <GraduationCap className="size-5" />
                </span>
                {c.status !== "published" && (
                  <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-semibold text-body">
                    Draft
                  </span>
                )}
              </div>
              {c.categoryName && (
                <span
                  className="mb-2 w-fit rounded-md px-2 py-0.5 text-xs font-semibold"
                  style={{
                    color: c.categoryColor ?? "#6366F1",
                    backgroundColor: `${c.categoryColor ?? "#6366F1"}1a`,
                  }}
                >
                  {c.categoryName}
                </span>
              )}
              <h3 className="font-semibold leading-snug text-heading group-hover:text-indigo">
                {c.title}
              </h3>
              {c.description && (
                <p className="mt-1 line-clamp-2 text-sm text-body">
                  {c.description}
                </p>
              )}
              <div className="mt-3 text-xs text-muted">
                {c.lessonCount} lesson{c.lessonCount === 1 ? "" : "s"}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
