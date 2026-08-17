import { redirect } from "next/navigation";
import { getActor, hasPermission } from "@/server/authz";
import { listCategories } from "@/server/kb/categories";
import { UploadForm } from "./UploadForm";

export default async function UploadDocumentPage() {
  const actor = await getActor();
  if (!actor) redirect("/signin");
  if (!hasPermission(actor.role, "document:create")) redirect("/documents");

  const cats = await listCategories(actor.orgId);

  return (
    <div className="mx-auto max-w-[1200px] px-8 py-8">
      <header className="mb-8">
        <h1 className="text-[32px] font-semibold leading-tight tracking-tight text-heading">
          Upload a document
        </h1>
        <p className="mt-1 text-body-lg text-body">
          Add a file to your knowledge base.
        </p>
      </header>
      <section className="rounded-xl border border-border bg-surface p-6">
        <UploadForm categories={cats.map((c) => ({ id: c.id, name: c.name }))} />
      </section>
    </div>
  );
}
