"use client";

import { NotebookPen, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { addNoteAction, deleteNoteAction } from "@/server/kb/note-actions";
import type { Note } from "@/server/kb/notes";
import { usePlayerControls, usePlayerTime } from "./player-context";

function fmt(s: number): string {
  const m = Math.floor(s / 60);
  const ss = String(Math.floor(s % 60)).padStart(2, "0");
  return `${m}:${ss}`;
}

export function NotesPanel({
  videoId,
  initialNotes,
}: {
  videoId: string;
  initialNotes: Note[];
}) {
  const controls = usePlayerControls();
  const currentTime = usePlayerTime();
  const [notes, setNotes] = useState<Note[]>(initialNotes);
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function add() {
    setError(null);
    const text = body.trim();
    if (!text) return;
    startTransition(async () => {
      const res = await addNoteAction(videoId, currentTime, text);
      if (res.error) {
        setError(res.error);
        return;
      }
      if (res.ok) {
        setNotes((ns) =>
          [...ns, res.ok!].sort(
            (a, b) => a.timestampSeconds - b.timestampSeconds,
          ),
        );
        setBody("");
      }
    });
  }

  function remove(id: string) {
    setNotes((ns) => ns.filter((n) => n.id !== id));
    startTransition(async () => {
      await deleteNoteAction(id, videoId);
    });
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-heading">
        <NotebookPen className="size-5 text-indigo" />
        My notes
      </h2>

      <div className="mb-4 flex items-start gap-2">
        <span className="mt-2 shrink-0 rounded-md bg-nav-active px-2 py-1 font-mono text-xs text-body">
          {fmt(currentTime)}
        </span>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={2}
          placeholder="Add a note at the current time…"
          className="flex-1 rounded-lg border border-border bg-canvas px-3 py-2 text-sm text-heading placeholder:text-muted focus:border-indigo focus:outline-none"
        />
        <button
          type="button"
          onClick={add}
          disabled={pending || !body.trim()}
          className="mt-1 h-9 shrink-0 rounded-lg bg-slate px-3 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          Add
        </button>
      </div>
      {error && <p className="mb-2 text-sm text-danger">{error}</p>}

      {notes.length === 0 ? (
        <p className="text-sm text-muted">
          No notes yet — add one pinned to the current moment.
        </p>
      ) : (
        <ul className="space-y-2">
          {notes.map((n) => (
            <li key={n.id} className="flex items-start gap-2">
              <button
                type="button"
                onClick={() => controls?.seek(n.timestampSeconds)}
                className="mt-0.5 shrink-0 rounded-md bg-indigo-soft px-2 py-0.5 font-mono text-xs font-medium text-indigo hover:underline"
              >
                {fmt(n.timestampSeconds)}
              </button>
              <p className="flex-1 whitespace-pre-line text-sm text-body">
                {n.body}
              </p>
              <button
                type="button"
                onClick={() => remove(n.id)}
                className="shrink-0 rounded-md p-1 text-muted hover:bg-nav-active hover:text-danger"
                aria-label="Delete note"
              >
                <Trash2 className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
