import {
  Clock,
  FileText,
  Film,
  FolderOpen,
  Image as ImageIcon,
  LayoutGrid,
  List as ListIcon,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getActor } from "@/server/authz";
import {
  browseDocuments,
  browseVideos,
  categoryCounts,
  type BrowseItem,
} from "@/server/kb/browse";

type Search = {
  type?: string;
  category?: string;
  content?: string;
  view?: string;
};

function href(current: Search, overrides: Partial<Search>): string {
  const merged = { ...current, ...overrides };
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(merged)) if (v) p.set(k, v);
  const qs = p.toString();
  return `/knowledge-base${qs ? `?${qs}` : ""}`;
}

function initials(name: string | null): string {
  const s = (name ?? "?").trim();
  const parts = s.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return s.slice(0, 2).toUpperCase();
}

function typeMeta(item: BrowseItem): { label: string; Icon: typeof FileText } {
  if (item.kind === "video") return { label: "Video", Icon: Film };
  if (item.docType === "uploaded") {
    if (item.mimeType?.startsWith("image/")) return { label: "Image", Icon: ImageIcon };
    if (item.mimeType === "application/pdf") return { label: "PDF", Icon: FileText };
    return { label: "File", Icon: FileText };
  }
  return { label: "Doc", Icon: FileText };
}

function itemHref(item: BrowseItem): string {
  return item.kind === "video" ? `/videos/${item.id}` : `/documents/${item.id}`;
}

function Pill({
  active,
  href: to,
  icon: Icon,
  children,
}: {
  active: boolean;
  href: string;
  icon?: typeof Clock;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={to}
      className={`flex h-9 items-center gap-1.5 rounded-full border px-4 text-sm font-medium transition-colors ${
        active
          ? "border-transparent bg-indigo-soft text-indigo"
          : "border-border bg-surface text-body hover:border-border-strong"
      }`}
    >
      {Icon && <Icon className="size-4" />}
      {children}
    </Link>
  );
}

function Avatar({ name, image }: { name: string | null; image: string | null }) {
  if (image) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={image} alt="" className="size-5 rounded-full object-cover" />;
  }
  return (
    <span className="flex size-5 items-center justify-center rounded-full bg-gradient-to-br from-indigo to-slate text-[9px] font-semibold text-white">
      {initials(name)}
    </span>
  );
}

function Chip({ name, color }: { name: string; color: string | null }) {
  return (
    <span
      className="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold"
      style={{
        color: color ?? "#6366F1",
        backgroundColor: `${color ?? "#6366F1"}1a`,
      }}
    >
      {name}
    </span>
  );
}

export default async function KnowledgeBasePage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const actor = await getActor();
  if (!actor) redirect("/signin");

  const sp = await searchParams;
  const type = sp.type ?? "all";
  const view = sp.view === "list" ? "list" : "grid";
  const pdfOnly = sp.content === "pdf";

  const wantsDocs = type === "all" || type === "documents";
  // The PDF content-type filter is document-specific, so it excludes videos.
  const wantsVideos = (type === "all" || type === "videos") && !pdfOnly;

  const [docs, vids, cats] = await Promise.all([
    wantsDocs
      ? browseDocuments(actor.orgId, { categorySlug: sp.category, pdfOnly })
      : Promise.resolve([] as BrowseItem[]),
    wantsVideos
      ? browseVideos(actor.orgId, { categorySlug: sp.category })
      : Promise.resolve([] as BrowseItem[]),
    categoryCounts(actor.orgId),
  ]);

  const items = [...docs, ...vids].sort(
    (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime(),
  );

  return (
    <div className="mx-auto max-w-[1200px] px-8 py-8">
      <header className="mb-6">
        <h1 className="text-[40px] font-bold leading-tight tracking-tight text-heading">
          Knowledge Base
        </h1>
        <p className="mt-1 text-body-lg text-body">
          Browse and discover organizational knowledge.
        </p>
      </header>

      {/* Filter pills + view toggle */}
      <div className="mb-6 flex items-center justify-between gap-4 border-b border-border pb-6">
        <div className="flex flex-wrap items-center gap-2">
          <Pill active={type === "all"} href={href(sp, { type: undefined })}>
            All
          </Pill>
          <Pill active={type === "documents"} href={href(sp, { type: "documents" })}>
            Documents
          </Pill>
          <Pill active={type === "videos"} href={href(sp, { type: "videos" })} icon={Film}>
            Videos
          </Pill>
          <Pill
            active={type === "collections"}
            href={href(sp, { type: "collections" })}
            icon={FolderOpen}
          >
            Collections
          </Pill>
          <Pill active={false} href={href(sp, {})} icon={Clock}>
            Recently Added
          </Pill>
          <Pill active={false} href={href(sp, {})} icon={TrendingUp}>
            Most Viewed
          </Pill>
        </div>
        <div className="flex shrink-0 items-center gap-1 rounded-lg border border-border p-0.5">
          <Link
            href={href(sp, { view: undefined })}
            aria-label="Grid view"
            className={`rounded-md p-1.5 ${view === "grid" ? "bg-nav-active text-slate" : "text-muted"}`}
          >
            <LayoutGrid className="size-4" />
          </Link>
          <Link
            href={href(sp, { view: "list" })}
            aria-label="List view"
            className={`rounded-md p-1.5 ${view === "list" ? "bg-nav-active text-slate" : "text-muted"}`}
          >
            <ListIcon className="size-4" />
          </Link>
        </div>
      </div>

      <div className="flex gap-8">
        {/* Left filters */}
        <aside className="w-52 shrink-0">
          <h3 className="mb-3 text-sm font-semibold text-heading">Category</h3>
          <ul className="space-y-2">
            {cats.map((c) => {
              const selected = sp.category === c.slug;
              return (
                <li key={c.id}>
                  <Link
                    href={href(sp, { category: selected ? undefined : c.slug })}
                    className="flex items-center gap-2 text-sm text-body hover:text-heading"
                  >
                    <span
                      className={`flex size-4 items-center justify-center rounded border ${
                        selected ? "border-indigo bg-indigo text-white" : "border-border"
                      }`}
                    >
                      {selected && <span className="text-[10px] leading-none">✓</span>}
                    </span>
                    {c.name}
                    <span className="text-muted">({c.count})</span>
                  </Link>
                </li>
              );
            })}
            {cats.length === 0 && (
              <li className="text-sm text-muted">No categories</li>
            )}
          </ul>

          <h3 className="mb-3 mt-6 text-sm font-semibold text-heading">Content Type</h3>
          <ul className="space-y-2">
            <li>
              <Link
                href={href(sp, {
                  content: sp.content === "pdf" ? undefined : "pdf",
                })}
                className="flex items-center gap-2 text-sm text-body hover:text-heading"
              >
                <span
                  className={`flex size-4 items-center justify-center rounded border ${
                    sp.content === "pdf" ? "border-indigo bg-indigo text-white" : "border-border"
                  }`}
                >
                  {sp.content === "pdf" && <span className="text-[10px] leading-none">✓</span>}
                </span>
                PDF Documents
              </Link>
            </li>
          </ul>
        </aside>

        {/* Content */}
        <div className="min-w-0 flex-1">
          {items.length === 0 ? (
            <div className="rounded-xl border border-border bg-surface px-6 py-16 text-center text-sm text-body">
              {type === "collections"
                ? "Collections are coming soon."
                : "Nothing matches these filters yet."}
            </div>
          ) : view === "grid" ? (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {items.map((item) => {
                const { label, Icon } = typeMeta(item);
                return (
                  <Link
                    key={item.id}
                    href={itemHref(item)}
                    className="group flex flex-col overflow-hidden rounded-xl border border-border bg-surface transition-colors hover:border-border-strong"
                  >
                    <div className="relative flex h-32 items-center justify-center overflow-hidden bg-gradient-to-br from-indigo-soft to-nav-active">
                      <span className="absolute right-3 top-3 z-10 rounded-md bg-surface/80 px-2 py-0.5 text-xs font-semibold text-body">
                        {label}
                      </span>
                      {item.kind === "video" && item.posterKey ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={`/api/videos/${item.id}/poster`}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <Icon className="size-10 text-indigo/70" strokeWidth={1.5} />
                      )}
                    </div>
                    <div className="flex flex-1 flex-col p-4">
                      {item.categoryName && (
                        <div className="mb-2">
                          <Chip name={item.categoryName} color={item.categoryColor} />
                        </div>
                      )}
                      <h3 className="mb-1 font-semibold leading-snug text-heading group-hover:text-indigo">
                        {item.title}
                      </h3>
                      <p className="mb-4 line-clamp-2 text-sm text-body">
                        {item.excerpt}
                      </p>
                      <div className="mt-auto flex items-center gap-2 border-t border-border pt-3">
                        <Avatar name={item.authorName} image={item.authorImage} />
                        <span className="text-xs text-body">
                          {item.authorName ?? "Unknown"}
                        </span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
              {items.map((item) => {
                const { label, Icon } = typeMeta(item);
                return (
                  <li key={item.id}>
                    <Link
                      href={itemHref(item)}
                      className="flex items-center gap-4 px-5 py-3 hover:bg-nav-active"
                    >
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-indigo-soft text-indigo">
                        <Icon className="size-5" strokeWidth={1.5} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium text-heading">
                          {item.title}
                        </div>
                        <div className="truncate text-xs text-muted">
                          {label}
                          {item.categoryName ? ` · ${item.categoryName}` : ""} ·{" "}
                          {item.authorName ?? "Unknown"}
                        </div>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
