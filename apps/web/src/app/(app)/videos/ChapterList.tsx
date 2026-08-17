"use client";

import { usePlayerControls } from "./player-context";

function fmtTimestamp(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}

type Chapter = { start: number; title: string };

export function ChapterList({ chapters }: { chapters: Chapter[] }) {
  const controls = usePlayerControls();

  return (
    <ul className="space-y-1">
      {chapters.map((c, i) => (
        <li key={i}>
          <button
            type="button"
            onClick={() => controls?.seek(c.start)}
            className="flex w-full items-baseline gap-3 rounded-md px-2 py-1.5 text-left hover:bg-nav-active"
          >
            <span className="w-12 shrink-0 rounded bg-indigo-soft px-1.5 py-0.5 text-center text-xs font-medium text-indigo">
              {fmtTimestamp(c.start)}
            </span>
            <span className="text-sm text-heading">{c.title}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
