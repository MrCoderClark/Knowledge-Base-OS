"use client";

import { Check, UserPlus } from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { assignCourseAction } from "@/server/kb/course-actions";

type Member = {
  userId: string;
  name: string | null;
  email: string;
};
type Team = { id: string; name: string; memberCount: number };

export function AssignCourse({
  courseId,
  members,
  teams,
}: {
  courseId: string;
  members: Member[];
  teams: Team[];
}) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [teamId, setTeamId] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return members;
    return members.filter(
      (m) =>
        (m.name ?? "").toLowerCase().includes(q) ||
        m.email.toLowerCase().includes(q),
    );
  }, [members, query]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function assign() {
    setResult(null);
    startTransition(async () => {
      const res = await assignCourseAction({
        courseId,
        userIds: [...selected],
        teamId: teamId || null,
        dueAt: dueAt || null,
      });
      if (res.error) {
        setResult(res.error);
      } else {
        setResult(`Assigned to ${res.ok} ${res.ok === 1 ? "person" : "people"}.`);
        setSelected(new Set());
        setTeamId("");
      }
    });
  }

  const nothingChosen = selected.size === 0 && !teamId;

  return (
    <div className="grid gap-5 sm:grid-cols-2">
      {/* People */}
      <div>
        <label className="mb-1.5 block text-sm font-medium text-heading">
          People
        </label>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search people…"
          className="mb-2 h-9 w-full rounded-lg border border-border bg-canvas px-3 text-sm text-heading placeholder:text-muted focus:border-indigo focus:outline-none"
        />
        <div className="max-h-56 overflow-y-auto rounded-lg border border-border">
          {filtered.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-muted">No people.</p>
          ) : (
            filtered.map((m) => {
              const on = selected.has(m.userId);
              return (
                <button
                  key={m.userId}
                  type="button"
                  onClick={() => toggle(m.userId)}
                  className="flex w-full items-center gap-3 border-b border-border px-3 py-2 text-left last:border-0 hover:bg-nav-active"
                >
                  <span
                    className={`flex size-4 shrink-0 items-center justify-center rounded border ${
                      on ? "border-indigo bg-indigo text-white" : "border-border"
                    }`}
                  >
                    {on && <Check className="size-3" />}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm text-heading">
                      {m.name ?? m.email}
                    </span>
                    {m.name && (
                      <span className="block truncate text-xs text-muted">
                        {m.email}
                      </span>
                    )}
                  </span>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Team + due date + submit */}
      <div className="space-y-4">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-heading">
            Or a whole team
          </label>
          <select
            value={teamId}
            onChange={(e) => setTeamId(e.target.value)}
            className="h-9 w-full rounded-lg border border-border bg-canvas px-3 text-sm text-heading focus:border-indigo focus:outline-none"
          >
            <option value="">No team</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} ({t.memberCount})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-heading">
            Due date (optional)
          </label>
          <input
            type="date"
            value={dueAt}
            onChange={(e) => setDueAt(e.target.value)}
            className="h-9 w-full rounded-lg border border-border bg-canvas px-3 text-sm text-heading focus:border-indigo focus:outline-none"
          />
        </div>

        <button
          type="button"
          onClick={assign}
          disabled={pending || nothingChosen}
          className="inline-flex h-10 items-center gap-2 rounded-lg bg-slate px-4 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          <UserPlus className="size-4" />
          {pending ? "Assigning…" : "Assign course"}
        </button>
        {result && <p className="text-sm text-body">{result}</p>}
      </div>
    </div>
  );
}
