"use client";

import { Plus, Trash2, UserPlus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  addTeamMemberAction,
  createTeamAction,
  deleteTeamAction,
  removeTeamMemberAction,
  updateTeamAction,
} from "@/server/kb/team-actions";

type Member = { userId: string; name: string | null; email: string };
type Team = {
  id: string;
  name: string;
  description: string | null;
  members: Member[];
};

function TeamCard({
  team,
  allMembers,
}: {
  team: Team;
  allMembers: Member[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(team.name);
  const [description, setDescription] = useState(team.description ?? "");
  const [addId, setAddId] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const inTeam = new Set(team.members.map((m) => m.userId));
  const addable = allMembers.filter((m) => !inTeam.has(m.userId));

  function run(fn: () => Promise<{ ok?: true; error?: string }>) {
    setMsg(null);
    startTransition(async () => {
      const res = await fn();
      if (res.error) setMsg(res.error);
      else router.refresh();
    });
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      <div className="flex items-start justify-between gap-3">
        {editing ? (
          <div className="flex-1 space-y-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-9 w-full rounded-lg border border-border bg-canvas px-3 text-sm font-medium text-heading focus:border-indigo focus:outline-none"
            />
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Description (optional)"
              className="h-9 w-full rounded-lg border border-border bg-canvas px-3 text-sm text-body focus:border-indigo focus:outline-none"
            />
            <div className="flex gap-2">
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  run(async () => {
                    const res = await updateTeamAction(
                      team.id,
                      name,
                      description,
                    );
                    if (!res.error) setEditing(false);
                    return res;
                  })
                }
                className="h-8 rounded-lg bg-slate px-3 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditing(false);
                  setName(team.name);
                  setDescription(team.description ?? "");
                }}
                className="h-8 rounded-lg border border-border px-3 text-sm text-body hover:border-border-strong"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="min-w-0">
            <div className="font-semibold text-heading">{team.name}</div>
            {team.description && (
              <div className="text-sm text-body">{team.description}</div>
            )}
            <div className="mt-0.5 text-xs text-muted">
              {team.members.length} member{team.members.length === 1 ? "" : "s"}
            </div>
          </div>
        )}
        {!editing && (
          <div className="flex shrink-0 gap-1">
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="rounded-md px-2 py-1 text-sm text-body hover:bg-nav-active"
            >
              Rename
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                if (confirm(`Delete team "${team.name}"?`))
                  run(() => deleteTeamAction(team.id));
              }}
              className="rounded-md p-1.5 text-danger hover:bg-nav-active"
              aria-label="Delete team"
            >
              <Trash2 className="size-4" />
            </button>
          </div>
        )}
      </div>

      {/* Members */}
      <div className="mt-4 flex flex-wrap gap-2">
        {team.members.map((m) => (
          <span
            key={m.userId}
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-canvas px-2.5 py-1 text-sm text-body"
          >
            {m.name ?? m.email}
            <button
              type="button"
              disabled={pending}
              onClick={() => run(() => removeTeamMemberAction(team.id, m.userId))}
              className="text-muted hover:text-danger"
              aria-label={`Remove ${m.name ?? m.email}`}
            >
              <X className="size-3.5" />
            </button>
          </span>
        ))}
        {team.members.length === 0 && (
          <span className="text-sm text-muted">No members yet.</span>
        )}
      </div>

      {/* Add member */}
      {addable.length > 0 && (
        <div className="mt-3 flex gap-2">
          <select
            value={addId}
            onChange={(e) => setAddId(e.target.value)}
            className="h-9 flex-1 rounded-lg border border-border bg-canvas px-3 text-sm text-heading focus:border-indigo focus:outline-none"
          >
            <option value="">Add a member…</option>
            {addable.map((m) => (
              <option key={m.userId} value={m.userId}>
                {m.name ?? m.email}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={pending || !addId}
            onClick={() =>
              run(async () => {
                const res = await addTeamMemberAction(team.id, addId);
                if (!res.error) setAddId("");
                return res;
              })
            }
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-sm font-medium text-body hover:border-border-strong disabled:opacity-50"
          >
            <UserPlus className="size-4" />
            Add
          </button>
        </div>
      )}
      {msg && <p className="mt-2 text-sm text-danger">{msg}</p>}
    </div>
  );
}

export function TeamsManager({
  teams,
  allMembers,
}: {
  teams: Team[];
  allMembers: Member[];
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function create() {
    setMsg(null);
    startTransition(async () => {
      const res = await createTeamAction(name, description);
      if (res.error) setMsg(res.error);
      else {
        setName("");
        setDescription("");
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-6">
      {/* Create */}
      <div className="rounded-xl border border-border bg-surface p-5">
        <h2 className="mb-3 text-lg font-semibold text-heading">New team</h2>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Team name"
            className="h-10 flex-1 rounded-lg border border-border bg-canvas px-3 text-sm text-heading placeholder:text-muted focus:border-indigo focus:outline-none"
          />
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description (optional)"
            className="h-10 flex-1 rounded-lg border border-border bg-canvas px-3 text-sm text-body placeholder:text-muted focus:border-indigo focus:outline-none"
          />
          <button
            type="button"
            onClick={create}
            disabled={pending || !name.trim()}
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-slate px-4 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            <Plus className="size-4" />
            Create
          </button>
        </div>
        {msg && <p className="mt-2 text-sm text-danger">{msg}</p>}
      </div>

      {teams.length === 0 ? (
        <p className="rounded-xl border border-border bg-surface px-6 py-12 text-center text-sm text-body">
          No teams yet. Create one above.
        </p>
      ) : (
        <div className="space-y-3">
          {teams.map((t) => (
            <TeamCard key={t.id} team={t} allMembers={allMembers} />
          ))}
        </div>
      )}
    </div>
  );
}
