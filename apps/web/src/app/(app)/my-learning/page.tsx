import { redirect } from "next/navigation";
import { getActor } from "@/server/authz";
import { listUserBadges, rankFor } from "@/server/kb/badges";
import { myCourses } from "@/server/kb/progress";
import { MyLearningTabs } from "./MyLearningTabs";

export default async function MyLearningPage() {
  const actor = await getActor();
  if (!actor) redirect("/signin");

  const [cards, badges] = await Promise.all([
    myCourses(actor.orgId, actor.userId),
    listUserBadges(actor.userId),
  ]);
  const points = badges.reduce((sum, b) => sum + b.points, 0);
  const rank = rankFor(points);

  return (
    <div className="mx-auto max-w-[1200px] px-8 py-8">
      <header className="mb-8">
        <h1 className="text-[32px] font-semibold leading-tight tracking-tight text-heading">
          My Learning
        </h1>
        <p className="mt-1 text-body-lg text-body">
          Your enrolled and assigned training, all in one place.
        </p>
      </header>

      {/* Achievements */}
      <section className="mb-8 rounded-xl border border-border bg-surface p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-muted">
              Your rank
            </div>
            <div className="text-2xl font-bold text-heading">{rank}</div>
          </div>
          <div className="text-right">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted">
              Points
            </div>
            <div className="text-2xl font-bold text-indigo">{points}</div>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {badges.length === 0 ? (
            <p className="text-sm text-muted">
              Complete courses and ace quizzes to earn badges.
            </p>
          ) : (
            badges.map((b) => (
              <span
                key={b.key}
                title={`${b.name} — ${b.description}`}
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-canvas px-3 py-1.5 text-sm text-body"
              >
                <span className="text-base">{b.icon}</span>
                <span className="font-medium text-heading">{b.name}</span>
                <span className="text-xs text-muted">+{b.points}</span>
              </span>
            ))
          )}
        </div>
      </section>

      {cards.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface px-6 py-16 text-center text-sm text-body">
          You&apos;re not enrolled in any courses yet.
        </div>
      ) : (
        <MyLearningTabs
          cards={cards.map((c) => ({
            courseId: c.courseId,
            title: c.title,
            status: c.status,
            assigned: c.assigned,
            dueAt: c.dueAt,
            coursePct: c.coursePct,
            started: c.started,
            doneLessons: c.doneLessons,
            totalLessons: c.totalLessons,
            resumeLessonId: c.resumeLessonId,
            certificateCode: c.certificateCode,
          }))}
        />
      )}
    </div>
  );
}
