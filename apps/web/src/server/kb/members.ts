import { and, eq, inArray, sql } from "drizzle-orm";
import type { OrgRole } from "@/server/authz";
import { db } from "@/server/db";
import { memberships, teams, users } from "@/server/db/schema";

export type OrgMember = {
  userId: string;
  name: string | null;
  email: string;
  role: "owner" | "admin" | "editor" | "viewer";
};

/** Active members of an org (for assignment pickers). */
export function listOrgMembers(orgId: string): Promise<OrgMember[]> {
  return db
    .select({
      userId: users.id,
      name: users.name,
      email: users.email,
      role: memberships.role,
    })
    .from(memberships)
    .innerJoin(users, eq(memberships.userId, users.id))
    .where(
      and(eq(memberships.orgId, orgId), eq(memberships.status, "active")),
    )
    .orderBy(users.name);
}

export type MemberWithGrants = {
  userId: string;
  name: string | null;
  email: string;
  role: OrgRole;
  grants: string[];
};

/** Active members with their role + per-member permission grants. */
export function listMembersWithGrants(
  orgId: string,
): Promise<MemberWithGrants[]> {
  return db
    .select({
      userId: users.id,
      name: users.name,
      email: users.email,
      role: memberships.role,
      grants: memberships.extraPermissions,
    })
    .from(memberships)
    .innerJoin(users, eq(memberships.userId, users.id))
    .where(
      and(eq(memberships.orgId, orgId), eq(memberships.status, "active")),
    )
    .orderBy(users.name);
}

export async function getMemberRole(
  orgId: string,
  userId: string,
): Promise<OrgRole | null> {
  const [row] = await db
    .select({ role: memberships.role })
    .from(memberships)
    .where(and(eq(memberships.orgId, orgId), eq(memberships.userId, userId)));
  return row?.role ?? null;
}

/** Count of active owners+admins in the org (last-admin guard). */
export async function countAdmins(orgId: string): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)`.mapWith(Number) })
    .from(memberships)
    .where(
      and(
        eq(memberships.orgId, orgId),
        eq(memberships.status, "active"),
        inArray(memberships.role, ["owner", "admin"]),
      ),
    );
  return row?.n ?? 0;
}

export async function updateMemberRole(
  orgId: string,
  userId: string,
  role: OrgRole,
): Promise<void> {
  await db
    .update(memberships)
    .set({ role })
    .where(and(eq(memberships.orgId, orgId), eq(memberships.userId, userId)));
}

export async function updateMemberGrants(
  orgId: string,
  userId: string,
  grants: string[],
): Promise<void> {
  await db
    .update(memberships)
    .set({ extraPermissions: grants })
    .where(and(eq(memberships.orgId, orgId), eq(memberships.userId, userId)));
}

export type TeamOption = {
  id: string;
  name: string;
  memberCount: number;
};

export function listTeams(orgId: string): Promise<TeamOption[]> {
  return db
    .select({
      id: teams.id,
      name: teams.name,
      memberCount:
        sql<number>`(select count(*) from team_members where team_members.team_id = ${teams.id})`.mapWith(
          Number,
        ),
    })
    .from(teams)
    .where(eq(teams.orgId, orgId))
    .orderBy(teams.name);
}
