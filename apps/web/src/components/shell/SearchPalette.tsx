"use client";

import { FileText, Search, Video } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Highlight } from "@/components/search/Highlight";

type Hit = {
  id: string;
  type: "document" | "video";
  title: string;
  snippet: string;
  href: string;
};

export function SearchPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setHits([]);
    setActive(0);
  }, []);

  // Global ⌘K / Ctrl+K to open.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  // Debounced search. All state updates happen inside the timeout (never
  // synchronously in the effect body).
  useEffect(() => {
    if (!open) return;
    const text = query.trim();
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      if (text.length < 2) {
        setHits([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(text)}`, {
          signal: ctrl.signal,
        });
        const data = (await res.json()) as { hits: Hit[] };
        setHits(data.hits ?? []);
        setActive(0);
      } catch {
        /* aborted or failed */
      } finally {
        setLoading(false);
      }
    }, 150);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [query, open]);

  function go(hit: Hit) {
    close();
    router.push(hit.href);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") return close();
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, hits.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (hits[active]) go(hits[active]);
      else if (query.trim().length >= 2) {
        close();
        router.push(`/search?q=${encodeURIComponent(query.trim())}`);
      }
    }
  }

  return (
    <>
      {/* Topbar trigger (looks like the search box). */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="relative flex h-10 max-w-2xl flex-1 items-center rounded-lg border border-border bg-canvas pl-10 pr-16 text-left text-body-md text-muted hover:border-border-strong"
      >
        <Search className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-muted" />
        Search documents, videos, and training…
        <kbd className="absolute right-3 top-1/2 -translate-y-1/2 rounded border border-border bg-surface px-1.5 py-0.5 text-xs font-medium text-muted">
          ⌘K
        </kbd>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-slate/40 p-4 pt-[10vh]"
          onClick={close}
        >
          <div
            className="w-full max-w-xl overflow-hidden rounded-xl border border-border bg-surface shadow-overlay"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 border-b border-border px-4">
              <Search className="size-5 shrink-0 text-muted" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder="Search documents and videos…"
                className="h-12 flex-1 bg-transparent text-body-md text-heading placeholder:text-muted focus:outline-none"
              />
              <kbd className="rounded border border-border px-1.5 py-0.5 text-xs text-muted">
                Esc
              </kbd>
            </div>

            <div className="max-h-[60vh] overflow-y-auto p-2">
              {query.trim().length < 2 ? (
                <p className="px-3 py-6 text-center text-sm text-muted">
                  Type at least 2 characters to search.
                </p>
              ) : loading && hits.length === 0 ? (
                <p className="px-3 py-6 text-center text-sm text-muted">Searching…</p>
              ) : hits.length === 0 ? (
                <p className="px-3 py-6 text-center text-sm text-muted">
                  No results for &ldquo;{query.trim()}&rdquo;.
                </p>
              ) : (
                <ul>
                  {hits.map((h, i) => {
                    const Icon = h.type === "document" ? FileText : Video;
                    return (
                      <li key={`${h.type}-${h.id}`}>
                        <button
                          type="button"
                          onMouseEnter={() => setActive(i)}
                          onClick={() => go(h)}
                          className={`flex w-full items-start gap-3 rounded-md px-3 py-2 text-left ${
                            i === active ? "bg-nav-active" : "hover:bg-nav-active"
                          }`}
                        >
                          <Icon className="mt-0.5 size-4 shrink-0 text-indigo" />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium text-heading">
                              {h.title}
                            </span>
                            <span className="block truncate text-xs text-muted">
                              <Highlight text={h.snippet} />
                            </span>
                          </span>
                          <span className="shrink-0 text-[10px] uppercase tracking-wide text-muted">
                            {h.type}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            {query.trim().length >= 2 && (
              <button
                type="button"
                onClick={() => {
                  const q = query.trim();
                  close();
                  router.push(`/search?q=${encodeURIComponent(q)}`);
                }}
                className="block w-full border-t border-border px-4 py-2.5 text-left text-sm font-medium text-indigo hover:bg-nav-active"
              >
                See all results for &ldquo;{query.trim()}&rdquo;
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
}
