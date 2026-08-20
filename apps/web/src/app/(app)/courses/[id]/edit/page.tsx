import { notFound, redirect } from "next/navigation";
import { isAIConfigured } from "@/server/ai";
import { getActor, hasPermission } from "@/server/authz";
import { listCategories } from "@/server/kb/categories";
import { getCourse, getCourseLessons } from "@/server/kb/courses";
import { listOrgMembers, listTeams } from "@/server/kb/members";
import { getCourseQuiz } from "@/server/kb/quizzes";
import { listVideos } from "@/server/kb/videos";
import { AssignCourse } from "../../AssignCourse";
import { CourseBuilder } from "../../CourseBuilder";
import { CourseForm } from "../../CourseForm";
import { CourseSettings } from "../../CourseSettings";
import { QuizEditor } from "../../QuizEditor";

export default async function EditCoursePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const actor = await getActor();
  if (!actor) redirect("/signin");
  if (!hasPermission(actor.role, "course:manage")) redirect(`/courses/${id}`);

  const course = await getCourse(actor.orgId, id);
  if (!course) notFound();

  const [lessons, cats, allVideos, members, teams, quiz] = await Promise.all([
    getCourseLessons(id),
    listCategories(actor.orgId),
    listVideos(actor.orgId),
    listOrgMembers(actor.orgId),
    listTeams(actor.orgId),
    getCourseQuiz(id),
  ]);

  const lessonVideoIds = new Set(lessons.map((l) => l.itemId));
  const availableVideos = allVideos
    .filter((v) => v.status === "ready" && !lessonVideoIds.has(v.id))
    .map((v) => ({ id: v.id, title: v.title }));

  return (
    <div className="mx-auto max-w-[1200px] px-8 py-8">
      <header className="mb-8">
        <h1 className="text-[32px] font-semibold leading-tight tracking-tight text-heading">
          Edit course
        </h1>
        <p className="mt-1 text-body-lg text-body">{course.title}</p>
      </header>

      <section className="mb-8 rounded-xl border border-border bg-surface p-6">
        <h2 className="mb-4 text-lg font-semibold text-heading">Details</h2>
        <CourseForm
          categories={cats.map((c) => ({ id: c.id, name: c.name }))}
          course={{
            id: course.id,
            title: course.title,
            description: course.description,
            categoryId: course.categoryId,
          }}
        />
      </section>

      <CourseBuilder
        courseId={course.id}
        status={course.status}
        lessons={lessons.map((l) => ({
          id: l.id,
          title: l.overrideTitle ?? l.videoTitle ?? "Lesson",
          duration: l.videoDuration,
        }))}
        availableVideos={availableVideos}
      />

      <section className="mt-8 rounded-xl border border-border bg-surface p-6">
        <h2 className="mb-4 text-lg font-semibold text-heading">Settings</h2>
        <CourseSettings
          courseId={course.id}
          required={course.required}
          antiSkip={course.antiSkip}
        />
      </section>

      <section className="mt-8 rounded-xl border border-border bg-surface p-6">
        <h2 className="mb-1 flex items-center gap-2 text-lg font-semibold text-heading">
          Assign this course
        </h2>
        <p className="mb-4 text-sm text-body">
          Enroll people or a team. They&apos;ll be notified, and it shows in their
          My Learning.
          {course.status !== "published" && (
            <span className="text-danger"> Publish the course so learners can open it.</span>
          )}
        </p>
        <AssignCourse
          courseId={course.id}
          members={members.map((m) => ({
            userId: m.userId,
            name: m.name,
            email: m.email,
          }))}
          teams={teams}
        />
      </section>

      <section className="mt-8 rounded-xl border border-border bg-surface p-6">
        <h2 className="mb-1 text-lg font-semibold text-heading">Course quiz</h2>
        <p className="mb-4 text-sm text-body">
          An optional end-of-course quiz. When set, learners must pass it to
          complete the course.
        </p>
        <QuizEditor
          courseId={course.id}
          aiEnabled={isAIConfigured()}
          lessons={lessons
            .filter((l) => l.itemType === "video")
            .map((l) => ({
              lessonId: l.id,
              videoId: l.itemId,
              title: l.overrideTitle ?? l.videoTitle ?? "Lesson",
            }))}
          initial={
            quiz
              ? {
                  title: quiz.title,
                  passPct: quiz.passPct,
                  questions: quiz.questions.map((q) => ({
                    prompt: q.prompt,
                    options: q.options,
                    correctIndex: q.correctIndex,
                  })),
                }
              : null
          }
        />
      </section>
    </div>
  );
}
