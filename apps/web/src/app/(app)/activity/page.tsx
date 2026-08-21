import { Activity, FileText, GraduationCap, UsersRound, Video } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { can, getActor } from "@/server/authz";
import { listActivity } from "@/server/kb/activity";

const KIND_ICON: Record<string, LucideIcon> = {
  document: FileText,
  video: Video,
  course: GraduationCap,
  team: UsersRound,
};

export default async function ActivityPage() {
  const actor = await getActor();
  if (!actor) redirect("/signin");
  if (!can(actor, "activity:read")) redirect("/");

  const events = await listActivity(actor.orgId, 60);

  return (
    <div className="mx-auto max-w-[900px] px-8 py-8">
      <header className="mb-8">
        <h1 className="flex items-center gap-2 text-[32px] font-semibold leading-tight tracking-tight text-heading">
          <Activity className="size-7 text-indigo" />
          Activity
        </h1>
        <p className="mt-1 text-body-lg text-body">
          Recent activity across your organization.
        </p>
      </header>

      {events.length === 0 ? (
        <p className="rounded-xl border border-border bg-surface px-6 py-16 text-center text-sm text-body">
          No activity yet. Publishing content, uploading videos, assigning or
          completing courses will show up here.
        </p>
      ) : (
        <ol className="space-y-1">
          {events.map((e) => {
            const Icon = KIND_ICON[e.objectKind] ?? Activity;
            return (
              <li
                key={e.id}
                className="flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-nav-active"
              >
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-indigo-soft text-indigo">
                  <Icon className="size-4" />
                </span>
                <p className="min-w-0 flex-1 text-sm text-body">
                  <span className="font-semibold text-heading">{e.who}</span>{" "}
                  {e.verb} {e.objectKind}{" "}
                  {e.linkUrl ? (
                    <Link
                      href={e.linkUrl}
                      className="font-medium text-indigo hover:underline"
                    >
                      {e.title}
                    </Link>
                  ) : (
                    <span className="font-medium text-heading">{e.title}</span>
                  )}
                </p>
                <span className="shrink-0 text-xs text-muted">{e.whenLabel}</span>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
