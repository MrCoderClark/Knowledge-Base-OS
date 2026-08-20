import { redirect } from "next/navigation";
import { isAIConfigured } from "@/server/ai";
import { getActor, hasPermission } from "@/server/authz";
import { listCategories } from "@/server/kb/categories";
import { CourseForm } from "../CourseForm";

export default async function NewCoursePage() {
  const actor = await getActor();
  if (!actor) redirect("/signin");
  if (!hasPermission(actor.role, "course:manage")) redirect("/courses");

  const cats = await listCategories(actor.orgId);

  return (
    <div className="mx-auto max-w-[1200px] px-8 py-8">
      <header className="mb-8">
        <h1 className="text-[32px] font-semibold leading-tight tracking-tight text-heading">
          New course
        </h1>
        <p className="mt-1 text-body-lg text-body">
          Name the course; you&apos;ll add lessons next.
        </p>
      </header>
      <section className="rounded-xl border border-border bg-surface p-6">
        <CourseForm
          categories={cats.map((c) => ({ id: c.id, name: c.name }))}
          aiEnabled={isAIConfigured()}
        />
      </section>
    </div>
  );
}
