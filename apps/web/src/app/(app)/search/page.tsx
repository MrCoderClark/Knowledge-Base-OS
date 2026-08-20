import { FileText, Search, Video } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Highlight } from "@/components/search/Highlight";
import { getActor } from "@/server/authz";
import { getSearchProvider } from "@/server/search";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const actor = await getActor();
  if (!actor) redirect("/signin");
  const { q } = await searchParams;
  const text = (q ?? "").trim();

  const hits =
    text.length >= 2
      ? (await getSearchProvider().search({ orgId: actor.orgId, text, limit: 30 }))
          .hits
      : [];

  return (
    <div className="mx-auto max-w-[900px] px-8 py-8">
      <header className="mb-6">
        <h1 className="flex items-center gap-2 text-[32px] font-semibold leading-tight tracking-tight text-heading">
          <Search className="size-7 text-indigo" />
          Search
        </h1>
        {/* GET form so the URL carries ?q= (server-rendered results). */}
        <form action="/search" method="get" className="mt-4">
          <input
            type="text"
            name="q"
            defaultValue={text}
            autoFocus
            placeholder="Search documents and videos…"
            className="h-11 w-full rounded-lg border border-border bg-canvas px-4 text-body-md text-heading placeholder:text-muted focus:border-indigo focus:outline-none focus:ring-2 focus:ring-indigo/20"
          />
        </form>
      </header>

      {text.length < 2 ? (
        <p className="rounded-xl border border-border bg-surface px-6 py-16 text-center text-sm text-body">
          Type a search above, or press ⌘K anywhere.
        </p>
      ) : hits.length === 0 ? (
        <p className="rounded-xl border border-border bg-surface px-6 py-16 text-center text-sm text-body">
          No results for &ldquo;{text}&rdquo;.
        </p>
      ) : (
        <>
          <p className="mb-3 text-sm text-muted">
            {hits.length} result{hits.length === 1 ? "" : "s"} for &ldquo;{text}
            &rdquo;
          </p>
          <ul className="space-y-2">
            {hits.map((h) => {
              const Icon = h.type === "document" ? FileText : Video;
              return (
                <li key={`${h.type}-${h.id}`}>
                  <Link
                    href={h.href}
                    className="flex items-start gap-3 rounded-xl border border-border bg-surface p-4 transition-colors hover:border-border-strong"
                  >
                    <Icon className="mt-0.5 size-5 shrink-0 text-indigo" />
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-heading">{h.title}</div>
                      <div className="text-sm text-body">
                        <Highlight text={h.snippet} />
                      </div>
                    </div>
                    <span className="shrink-0 text-[10px] uppercase tracking-wide text-muted">
                      {h.type}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
