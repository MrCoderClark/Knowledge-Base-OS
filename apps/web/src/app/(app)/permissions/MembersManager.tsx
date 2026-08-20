"use client";

import { ChevronDown, ChevronRight } from "lucide-react";
import { useState, useTransition } from "react";
import {
  setMemberGrantsAction,
  setMemberRoleAction,
} from "@/server/kb/permission-actions";

type Member = {
  userId: string;
  name: string | null;
  email: string;
  role: string;
  grants: string[];
};
type Group = { group: string; permissions: { key: string; label: string }[] };

const ROLES = ["owner", "admin", "editor", "viewer"];

function MemberRow({
  member,
  groups,
  roleInherited,
}: {
  member: Member;
  groups: Group[];
  roleInherited: Record<string, string[]>;
}) {
  const [role, setRole] = useState(member.role);
  const [grants, setGrants] = useState<Set<string>>(new Set(member.grants));
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const inherited = new Set(roleInherited[role] ?? []);

  function changeRole(next: string) {
    setMsg(null);
    const prev = role;
    setRole(next);
    startTransition(async () => {
      const res = await setMemberRoleAction(member.userId, next);
      if (res.error) {
        setRole(prev);
        setMsg(res.error);
      }
    });
  }

  function toggle(key: string) {
    setGrants((g) => {
      const next = new Set(g);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function saveGrants() {
    setMsg(null);
    startTransition(async () => {
      const res = await setMemberGrantsAction(member.userId, [...grants]);
      setMsg(res.error ?? "Saved.");
    });
  }

  const extraCount = [...grants].filter((k) => !inherited.has(k)).length;

  return (
    <div className="rounded-xl border border-border bg-surface">
      <div className="flex flex-wrap items-center gap-4 p-4">
        <div className="min-w-0 flex-1">
          <div className="font-medium text-heading">
            {member.name ?? member.email}
          </div>
          {member.name && (
            <div className="text-xs text-muted">{member.email}</div>
          )}
        </div>
        <select
          value={role}
          disabled={pending}
          onChange={(e) => changeRole(e.target.value)}
          className="h-9 rounded-lg border border-border bg-canvas px-3 text-sm capitalize text-heading focus:border-indigo focus:outline-none disabled:opacity-50"
        >
          {ROLES.map((r) => (
            <option key={r} value={r} className="capitalize">
              {r}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-2 text-sm font-medium text-body hover:border-border-strong"
        >
          {open ? (
            <ChevronDown className="size-4" />
          ) : (
            <ChevronRight className="size-4" />
          )}
          Permissions{extraCount > 0 ? ` (+${extraCount})` : ""}
        </button>
      </div>

      {open && (
        <div className="border-t border-border p-4">
          <div className="grid gap-4 sm:grid-cols-2">
            {groups.map((g) => (
              <div key={g.group}>
                <div className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted">
                  {g.group}
                </div>
                <div className="space-y-1">
                  {g.permissions.map((p) => {
                    const isInherited = inherited.has(p.key);
                    return (
                      <label
                        key={p.key}
                        className="flex items-center gap-2 text-sm text-body"
                      >
                        <input
                          type="checkbox"
                          checked={isInherited || grants.has(p.key)}
                          disabled={isInherited || pending}
                          onChange={() => toggle(p.key)}
                        />
                        <span className={isInherited ? "text-muted" : ""}>
                          {p.label}
                        </span>
                        {isInherited && (
                          <span className="rounded bg-nav-active px-1.5 py-0.5 text-[10px] font-medium text-muted">
                            via role
                          </span>
                        )}
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 flex items-center gap-3">
            <button
              type="button"
              onClick={saveGrants}
              disabled={pending}
              className="inline-flex h-9 items-center rounded-lg bg-slate px-4 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              {pending ? "Saving…" : "Save permissions"}
            </button>
            {msg && (
              <span
                className={`text-sm ${msg === "Saved." ? "text-success" : "text-danger"}`}
              >
                {msg}
              </span>
            )}
          </div>
        </div>
      )}

      {!open && msg && (
        <p
          className={`px-4 pb-3 text-sm ${msg === "Saved." ? "text-success" : "text-danger"}`}
        >
          {msg}
        </p>
      )}
    </div>
  );
}

export function MembersManager({
  members,
  groups,
  roleInherited,
}: {
  members: Member[];
  groups: Group[];
  roleInherited: Record<string, string[]>;
}) {
  if (members.length === 0) {
    return (
      <p className="rounded-xl border border-border bg-surface px-6 py-16 text-center text-sm text-body">
        No members yet.
      </p>
    );
  }
  return (
    <div className="space-y-3">
      {members.map((m) => (
        <MemberRow
          key={m.userId}
          member={m}
          groups={groups}
          roleInherited={roleInherited}
        />
      ))}
    </div>
  );
}
