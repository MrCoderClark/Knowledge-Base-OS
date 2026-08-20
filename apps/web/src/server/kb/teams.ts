import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "@/server/db";
import { teamMembers, teams, users } from "@/server/db/schema";

export type TeamMember = {
  userId: string;
  name: string | null;
  email: string;
};

export type TeamDetail = {
  id: string;
  name: string;
  description: string | null;
  members: TeamMember[];
};

/** All teams in an org with their members. */
export async function listTeamsDetailed(
  orgId: string,
): Promise<TeamDetail[]> {
  const ts = await db
    .select({
      id: teams.id,
      name: teams.name,
      description: teams.description,
    })
    .from(teams)
    .where(eq(teams.orgId, orgId))
    .orderBy(asc(teams.name));
  if (ts.length === 0) return [];

  const rows = await db
    .select({
      teamId: teamMembers.teamId,
      userId: users.id,
      name: users.name,
      email: users.email,
    })
    .from(teamMembers)
    .innerJoin(users, eq(teamMembers.userId, users.id))
    .where(
      inArray(
        teamMembers.teamId,
        ts.map((t) => t.id),
      ),
    )
    .orderBy(asc(users.name));

  const byTeam = new Map<string, TeamMember[]>();
  for (const r of rows) {
    const list = byTeam.get(r.teamId) ?? [];
    list.push({ userId: r.userId, name: r.name, email: r.email });
    byTeam.set(r.teamId, list);
  }
  return ts.map((t) => ({ ...t, members: byTeam.get(t.id) ?? [] }));
}

/** Whether a team belongs to the org (guard before member ops). */
export async function teamInOrg(
  orgId: string,
  teamId: string,
): Promise<boolean> {
  const [row] = await db
    .select({ id: teams.id })
    .from(teams)
    .where(and(eq(teams.id, teamId), eq(teams.orgId, orgId)));
  return !!row;
}

export async function createTeam(
  orgId: string,
  name: string,
  description: string | null,
): Promise<string> {
  const [row] = await db
    .insert(teams)
    .values({ orgId, name, description })
    .returning({ id: teams.id });
  return row.id;
}

export async function updateTeam(
  orgId: string,
  teamId: string,
  name: string,
  description: string | null,
): Promise<void> {
  await db
    .update(teams)
    .set({ name, description })
    .where(and(eq(teams.id, teamId), eq(teams.orgId, orgId)));
}

export async function deleteTeam(orgId: string, teamId: string): Promise<void> {
  await db
    .delete(teams)
    .where(and(eq(teams.id, teamId), eq(teams.orgId, orgId)));
}

export async function addTeamMember(
  teamId: string,
  userId: string,
): Promise<void> {
  await db
    .insert(teamMembers)
    .values({ teamId, userId })
    .onConflictDoNothing({ target: [teamMembers.teamId, teamMembers.userId] });
}

export async function removeTeamMember(
  teamId: string,
  userId: string,
): Promise<void> {
  await db
    .delete(teamMembers)
    .where(
      and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId)),
    );
}
