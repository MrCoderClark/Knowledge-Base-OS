import { notFound, redirect } from "next/navigation";
import { getActor, hasPermission } from "@/server/authz";
import { getDocument } from "@/server/kb/documents";
import { DocumentActions } from "../DocumentActions";
import { StatusBadge } from "../StatusBadge";

export default async function DocumentViewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const actor = await getActor();
  if (!actor) redirect("/signin");

  const doc = await getDocument(actor.orgId, id);
  if (!doc) notFound();

  return (
    <div className="mx-auto max-w-3xl px-8 py-8">
      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-3">
            <StatusBadge status={doc.status} />
            <span className="text-xs text-muted">
              v{doc.currentVersion}
            </span>
          </div>
          <h1 className="text-[32px] font-semibold leading-tight tracking-tight text-heading">
            {doc.title}
          </h1>
        </div>
        <DocumentActions
          id={doc.id}
          status={doc.status}
          canEdit={hasPermission(actor.role, "document:update")}
          canPublish={hasPermission(actor.role, "document:publish")}
          canDelete={hasPermission(actor.role, "document:delete")}
        />
      </header>

      <article
        className="doc-prose"
        dangerouslySetInnerHTML={{ __html: doc.bodyHtml ?? "" }}
      />
    </div>
  );
}
