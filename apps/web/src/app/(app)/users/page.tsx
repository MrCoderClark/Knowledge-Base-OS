import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { getActor, isAdmin } from "@/server/authz";
import { db } from "@/server/db";
import { memberships, users } from "@/server/db/schema";
import { InviteForm } from "./InviteForm";

type Display = { label: string; className: string };

function statusBadge(
  status: string,
  lockedUntil: Date | null,
): Display {
  if (lockedUntil && lockedUntil > new Date()) {
    return { label: "Locked", className: "bg-red-50 text-danger" };
  }
  switch (status) {
    case "active":
      return { label: "Active", className: "bg-green-50 text-success" };
    case "invited":
      return { label: "Invited", className: "bg-indigo-soft text-indigo" };
    case "suspended":
      return { label: "Suspended", className: "bg-slate-100 text-body" };
    default:
      return { label: status, className: "bg-slate-100 text-body" };
  }
}

export default async function UsersPage() {
  const actor = await getActor();
  if (!actor) redirect("/signin");
  if (!isAdmin(actor.role)) redirect("/");

  const rows = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      status: users.status,
      lockedUntil: users.lockedUntil,
      role: memberships.role,
    })
    .from(memberships)
    .innerJoin(users, eq(memberships.userId, users.id))
    .where(eq(memberships.orgId, actor.orgId));

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
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const badge = statusBadge(r.status, r.lockedUntil);
              return (
                <tr key={r.id} className={i > 0 ? "border-t border-border" : ""}>
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
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="mt-4 text-xs text-muted">
        Phase 1a · admin invite. Role changes, suspend/remove, and lock/unlock
        actions land with the full Users module.
      </p>
    </div>
  );
}
