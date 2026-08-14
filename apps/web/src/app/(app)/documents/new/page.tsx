import { redirect } from "next/navigation";
import { getActor, hasPermission } from "@/server/authz";
import { listCategories } from "@/server/kb/categories";
import { DocumentEditor } from "../DocumentEditor";

export default async function NewDocumentPage() {
  const actor = await getActor();
  if (!actor) redirect("/signin");
  if (!hasPermission(actor.role, "document:create")) redirect("/documents");

  const cats = await listCategories(actor.orgId);

  return (
    <div className="px-8 py-8">
      <DocumentEditor
        categories={cats.map((c) => ({ id: c.id, name: c.name }))}
      />
    </div>
  );
}
