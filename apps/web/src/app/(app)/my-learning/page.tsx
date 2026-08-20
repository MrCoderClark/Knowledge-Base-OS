import { redirect } from "next/navigation";
import { getActor } from "@/server/authz";
import { myCourses } from "@/server/kb/progress";
import { MyLearningTabs } from "./MyLearningTabs";

export default async function MyLearningPage() {
  const actor = await getActor();
  if (!actor) redirect("/signin");

  const cards = await myCourses(actor.orgId, actor.userId);

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
