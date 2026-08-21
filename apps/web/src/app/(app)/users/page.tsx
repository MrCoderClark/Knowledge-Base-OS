import { redirect } from "next/navigation";
import { can, getActor } from "@/server/authz";
import { listManagedUsers } from "@/server/kb/users";
import { InviteForm } from "./InviteForm";
import { UserRowActions } from "./UserRowActions";

type Display = { label: string; className: string };

function statusBadge(
  status: "invited" | "active" | "suspended",
  lockedUntil: Date | null,
): Display {
  // Suspended is a hard block and wins over a soft (temporary) lock.
  if (status === "suspended") {
    return { label: "Suspended", className: "bg-slate-100 text-body" };
  }
  if (lockedUntil && lockedUntil > new Date()) {
    return { label: "Locked", className: "bg-red-50 text-danger" };
  }
  switch (status) {
    case "active":
      return { label: "Active", className: "bg-green-50 text-success" };
    case "invited":
      return { label: "Invited", className: "bg-indigo-soft text-indigo" };
    default:
      return { label: status, className: "bg-slate-100 text-body" };
  }
}

function formatLastActive(d: Date | null): string {
  if (!d) return "—";
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default async function UsersPage() {
  const actor = await getActor();
  if (!actor) redirect("/signin");
  if (!can(actor, "member:manage")) redirect("/");

  const rows = await listManagedUsers(actor.orgId);

  return (
    <div className="mx-auto max-w-[1200px] px-8 py-8">
      <header className="mb-6">
        <h1 className="text-[32px] font-semibold leading-tight tracking-tight text-heading">
          Users
        </h1>
        <p className="mt-1 text-body-lg text-body">
          Invite and manage members of your organization.
        </p>
      </header>

      <section className="mb-8 rounded-xl border border-border bg-surface p-6">
        <h2 className="mb-4 text-lg font-semibold text-heading">Invite a user</h2>
        <InviteForm />
      </section>

      <div className="overflow-hidden rounded-xl border border-border bg-surface">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border text-xs font-semibold uppercase tracking-wider text-muted">
              <th className="px-5 py-3">Name</th>
              <th className="px-5 py-3">Email</th>
              <th className="px-5 py-3">Role</th>
              <th className="px-5 py-3">Status</th>
              <th className="px-5 py-3">Last active</th>
              <th className="px-5 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const badge = statusBadge(r.status, r.lockedUntil);
              const locked =
                r.status !== "suspended" &&
                !!r.lockedUntil &&
                r.lockedUntil > new Date();
              return (
                <tr key={r.userId} className={i > 0 ? "border-t border-border" : ""}>
                  <td className="px-5 py-3 font-medium text-heading">
                    {r.name ?? "—"}
                  </td>
                  <td className="px-5 py-3 text-body">{r.email}</td>
                  <td className="px-5 py-3 capitalize text-body">{r.role}</td>
                  <td className="px-5 py-3">
                    <span
                      className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold ${badge.className}`}
                    >
                      {badge.label}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-body">
                    {formatLastActive(r.lastLoginAt)}
                  </td>
                  <td className="px-5 py-3">
                    <UserRowActions
                      userId={r.userId}
                      name={r.name ?? r.email}
                      isSelf={r.userId === actor.userId}
                      status={r.status}
                      locked={locked}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
