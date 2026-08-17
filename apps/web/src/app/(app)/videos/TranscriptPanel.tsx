"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePlayerControls, usePlayerTime } from "./player-context";

type Cue = { start: number; end: number; text: string };

function parseTs(ts: string): number {
  const parts = ts.trim().split(":").map(Number);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return Number(ts) || 0;
}

function parseVtt(text: string): Cue[] {
  const cues: Cue[] = [];
  for (const block of text.replace(/\r/g, "").split("\n\n")) {
    const lines = block.split("\n").filter(Boolean);
    const timeIdx = lines.findIndex((l) => l.includes("-->"));
    if (timeIdx === -1) continue;
    const [a, b] = lines[timeIdx].split("-->");
    const start = parseTs(a);
    const end = parseTs((b ?? "").trim().split(" ")[0] ?? "");
    const cueText = lines.slice(timeIdx + 1).join(" ").trim();
    if (cueText) cues.push({ start, end, text: cueText });
  }
  return cues;
}

function fmtTimestamp(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}

export function TranscriptPanel({ captionsUrl }: { captionsUrl: string }) {
  const controls = usePlayerControls();
  const currentTime = usePlayerTime();
  const [cues, setCues] = useState<Cue[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const activeRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    let active = true;
    fetch(captionsUrl)
      .then((r) => r.text())
      .then((t) => {
        if (active) setCues(parseVtt(t));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [captionsUrl]);

  const activeIndex = cues.findIndex(
    (c) => currentTime >= c.start && currentTime < c.end,
  );

  // Keep the active line in view while playing.
  useEffect(() => {
    if (!query) activeRef.current?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, query]);

  const filtered = useMemo(() => {
    if (!query) return cues.map((c, i) => ({ c, i }));
    const q = query.toLowerCase();
    return cues
      .map((c, i) => ({ c, i }))
      .filter(({ c }) => c.text.toLowerCase().includes(q));
  }, [cues, query]);

  if (loading) return <p className="text-sm text-muted">Loading transcript…</p>;
  if (cues.length === 0)
    return <p className="text-sm text-muted">No transcript available.</p>;

  return (
    <div>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search transcript…"
        className="mb-3 h-9 w-full rounded-lg border border-border bg-canvas px-3 text-sm text-heading placeholder:text-muted focus:border-indigo focus:outline-none focus:ring-2 focus:ring-indigo/20"
      />
      <div className="max-h-80 space-y-0.5 overflow-y-auto">
        {filtered.map(({ c, i }) => {
          const isActive = !query && i === activeIndex;
          return (
            <button
              key={i}
              ref={isActive ? activeRef : null}
              type="button"
              onClick={() => controls?.seek(c.start)}
              className={`flex w-full gap-3 rounded-md px-2 py-1.5 text-left text-sm transition-colors ${
                isActive ? "bg-indigo-soft" : "hover:bg-nav-active"
              }`}
            >
              <span className="w-12 shrink-0 text-xs font-medium text-indigo">
                {fmtTimestamp(c.start)}
              </span>
              <span className={isActive ? "text-heading" : "text-body"}>
                {c.text}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
