import Link from "next/link";
import { redirect } from "next/navigation";
import { getActor, hasPermission } from "@/server/authz";
import { listVideos } from "@/server/kb/videos";

function relative(date: Date): string {
  const s = Math.floor((Date.now() - date.getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export default async function VideosPage() {
  const actor = await getActor();
  if (!actor) redirect("/signin");

  const canCreate = hasPermission(actor.role, "video:create");
  const rows = await listVideos(actor.orgId);

  return (
    <div className="mx-auto max-w-[1200px] px-8 py-8">
      <header className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-[32px] font-semibold leading-tight tracking-tight text-heading">
            Videos
          </h1>
          <p className="mt-1 text-body-lg text-body">
            Upload and watch training and recordings.
          </p>
        </div>
        {canCreate && (
          <Link
            href="/videos/upload"
            className="flex h-10 items-center rounded-lg bg-slate px-4 text-sm font-medium text-white hover:opacity-90"
          >
            Upload Video
          </Link>
        )}
      </header>

      <div className="overflow-hidden rounded-xl border border-border bg-surface">
        {rows.length === 0 ? (
          <p className="px-6 py-10 text-center text-sm text-body">
            No videos yet.{canCreate ? " Upload your first one." : ""}
          </p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs font-semibold uppercase tracking-wider text-muted">
                <th className="px-5 py-3">Title</th>
                <th className="px-5 py-3">Category</th>
                <th className="px-5 py-3">Added</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((v, i) => (
                <tr key={v.id} className={i > 0 ? "border-t border-border" : ""}>
                  <td className="px-5 py-3">
                    <Link
                      href={`/videos/${v.id}`}
                      className="font-medium text-heading hover:text-indigo"
                    >
                      {v.title}
                    </Link>
                  </td>
                  <td className="px-5 py-3">
                    {v.categoryName ? (
                      <span className="inline-flex items-center gap-1.5 text-body">
                        <span
                          className="size-2.5 rounded-full"
                          style={{ backgroundColor: v.categoryColor ?? "#94a3b8" }}
                        />
                        {v.categoryName}
                      </span>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-body">{relative(v.updatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
