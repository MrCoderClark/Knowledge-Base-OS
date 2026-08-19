import { and, eq, sql } from "drizzle-orm";
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
