import { notFound, redirect } from "next/navigation";
import { getActor, hasPermission } from "@/server/authz";
import { listCategories } from "@/server/kb/categories";
import { getCourse, getCourseLessons } from "@/server/kb/courses";
import { listVideos } from "@/server/kb/videos";
import { CourseBuilder } from "../../CourseBuilder";
import { CourseForm } from "../../CourseForm";

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

  const [lessons, cats, allVideos] = await Promise.all([
    getCourseLessons(id),
    listCategories(actor.orgId),
    listVideos(actor.orgId),
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
    </div>
  );
}
