import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getActor, hasPermission } from "@/server/authz";
import { getDocument } from "@/server/kb/documents";
import { DocumentActions } from "../DocumentActions";
import { StatusBadge } from "../StatusBadge";

function formatSize(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

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

  // Authored prose reads best in a narrow column; PDFs/files need width.
  const wide = doc.docType === "uploaded";

  return (
    <div className={`mx-auto px-8 py-8 ${wide ? "max-w-[1400px]" : "max-w-3xl"}`}>
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

      {doc.docType === "uploaded" ? (
        doc.mimeType?.startsWith("image/") ? (
          <img
            src={`/api/documents/${doc.id}/file`}
            alt={doc.title}
            className="max-w-full rounded-xl border border-border"
          />
        ) : doc.mimeType === "application/pdf" ? (
          <div>
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm text-muted">
                {formatSize(doc.sizeBytes)}
              </span>
              <div className="flex items-center gap-3">
                <Link
                  href={`/api/documents/${doc.id}/file`}
                  target="_blank"
                  className="text-sm font-medium text-indigo hover:underline"
                >
                  Open in new tab
                </Link>
                <Link
                  href={`/api/documents/${doc.id}/file?download=1`}
                  className="text-sm font-medium text-indigo hover:underline"
                >
                  Download
                </Link>
              </div>
            </div>
            <iframe
              src={`/api/documents/${doc.id}/file#view=FitH`}
              title={doc.title}
              className="h-[85vh] w-full rounded-xl border border-border bg-surface"
            />
          </div>
        ) : (
          <div className="flex items-center justify-between rounded-xl border border-border bg-surface p-5">
            <div className="min-w-0">
              <div className="truncate font-medium text-heading">{doc.title}</div>
              <div className="text-sm text-muted">
                {doc.mimeType ?? "file"}
                {doc.sizeBytes ? ` · ${formatSize(doc.sizeBytes)}` : ""}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Link
                href={`/api/documents/${doc.id}/file`}
                target="_blank"
                className="flex h-9 items-center rounded-lg bg-slate px-3 text-sm font-medium text-white hover:opacity-90"
              >
                Open
              </Link>
              <Link
                href={`/api/documents/${doc.id}/file?download=1`}
                className="flex h-9 items-center rounded-lg border border-border px-3 text-sm font-medium text-body hover:border-border-strong hover:text-slate"
              >
                Download
              </Link>
            </div>
          </div>
        )
      ) : (
        <article
          className="doc-prose"
          dangerouslySetInnerHTML={{ __html: doc.bodyHtml ?? "" }}
        />
      )}
    </div>
  );
}
