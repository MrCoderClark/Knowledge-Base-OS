import { notFound, redirect } from "next/navigation";
import { getActor, hasPermission } from "@/server/authz";
import { listCategories } from "@/server/kb/categories";
import { getVideo } from "@/server/kb/videos";
import { VideoEditForm } from "./VideoEditForm";

export default async function EditVideoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const actor = await getActor();
  if (!actor) redirect("/signin");
  if (!hasPermission(actor.role, "video:update")) redirect(`/videos/${id}`);

  const video = await getVideo(actor.orgId, id);
  if (!video) notFound();

  const cats = await listCategories(actor.orgId);

  return (
    <div className="mx-auto max-w-[1200px] px-8 py-8">
      <header className="mb-8">
        <h1 className="text-[32px] font-semibold leading-tight tracking-tight text-heading">
          Edit video
        </h1>
        <p className="mt-1 text-body-lg text-body">Update the title and category.</p>
      </header>
      <section className="rounded-xl border border-border bg-surface p-6">
        <VideoEditForm
          id={video.id}
          title={video.title}
          description={video.description}
          categoryId={video.categoryId}
          categories={cats.map((c) => ({ id: c.id, name: c.name }))}
        />
      </section>
    </div>
  );
}
