import { Shield } from "lucide-react";
import { redirect } from "next/navigation";
import { can, getActor } from "@/server/authz";
import { PERMISSION_GROUPS, rolePermissions } from "@/server/authz/permissions";
import { listMembersWithGrants } from "@/server/kb/members";
import { MembersManager } from "./MembersManager";

const ROLES = ["owner", "admin", "editor", "viewer"] as const;

export default async function PermissionsPage() {
  const actor = await getActor();
  if (!actor) redirect("/signin");
  if (!can(actor, "permissions:manage")) redirect("/");

  const members = await listMembersWithGrants(actor.orgId);
  const roleInherited: Record<string, string[]> = Object.fromEntries(
    ROLES.map((r) => [r, [...rolePermissions(r)]]),
  );

  return (
    <div className="mx-auto max-w-[1200px] px-8 py-8">
      <header className="mb-8">
        <h1 className="flex items-center gap-2 text-[32px] font-semibold leading-tight tracking-tight text-heading">
          <Shield className="size-7 text-indigo" />
          Permissions
        </h1>
        <p className="mt-1 text-body-lg text-body">
          Set each person&apos;s role, and grant individual permissions on top.
        </p>
      </header>

      <MembersManager
        members={members.map((m) => ({
          userId: m.userId,
          name: m.name,
          email: m.email,
          role: m.role,
          grants: m.grants,
        }))}
        groups={PERMISSION_GROUPS.map((g) => ({
          group: g.group,
          permissions: g.permissions.map((p) => ({
            key: p.key,
            label: p.label,
          })),
        }))}
        roleInherited={roleInherited}
      />
    </div>
  );
}
