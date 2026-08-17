import { notFound, redirect } from "next/navigation";
import { getActor, hasPermission } from "@/server/authz";
import { listCategories } from "@/server/kb/categories";
import { getDocument } from "@/server/kb/documents";
import { DocumentEditor } from "../../DocumentEditor";

export default async function EditDocumentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const actor = await getActor();
  if (!actor) redirect("/signin");
  if (!hasPermission(actor.role, "document:update")) redirect(`/documents/${id}`);

  const doc = await getDocument(actor.orgId, id);
  if (!doc) notFound();

  const cats = await listCategories(actor.orgId);

  return (
    <div className="px-8 py-8">
      <DocumentEditor
        categories={cats.map((c) => ({ id: c.id, name: c.name }))}
        initial={{
          id: doc.id,
          title: doc.title,
          categoryId: doc.categoryId,
          bodyJson: doc.body,
        }}
      />
    </div>
  );
}
