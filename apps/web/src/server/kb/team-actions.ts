"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/server/authz";
import { logActivity } from "./activity";
import {
  addTeamMember,
  createTeam,
  deleteTeam,
  removeTeamMember,
  teamInOrg,
  updateTeam,
} from "./teams";

type Result = { ok?: true; error?: string };

async function requireTeamManager() {
  return requirePermission("team:manage");
}

export async function createTeamAction(
  name: string,
  description: string,
): Promise<Result> {
  let actor;
  try {
    actor = await requireTeamManager();
  } catch {
    return { error: "You don't have permission to manage teams." };
  }
  const n = name.trim();
  if (!n) return { error: "Team name is required." };
  await createTeam(actor.orgId, n, description.trim() || null);
  await logActivity({
    orgId: actor.orgId,
    actorId: actor.userId,
    verb: "created",
    objectKind: "team",
    title: n,
    linkUrl: "/teams",
  });
  revalidatePath("/teams");
  return { ok: true };
}

export async function updateTeamAction(
  teamId: string,
  name: string,
  description: string,
): Promise<Result> {
  let actor;
  try {
    actor = await requireTeamManager();
  } catch {
    return { error: "You don't have permission to manage teams." };
  }
  const n = name.trim();
  if (!n) return { error: "Team name is required." };
  if (!(await teamInOrg(actor.orgId, teamId))) return { error: "Team not found." };
  await updateTeam(actor.orgId, teamId, n, description.trim() || null);
  revalidatePath("/teams");
  return { ok: true };
}

export async function deleteTeamAction(teamId: string): Promise<Result> {
  let actor;
  try {
    actor = await requireTeamManager();
  } catch {
    return { error: "You don't have permission to manage teams." };
  }
  await deleteTeam(actor.orgId, teamId);
  revalidatePath("/teams");
  return { ok: true };
}

export async function addTeamMemberAction(
  teamId: string,
  userId: string,
): Promise<Result> {
  let actor;
  try {
    actor = await requireTeamManager();
  } catch {
    return { error: "You don't have permission to manage teams." };
  }
  if (!(await teamInOrg(actor.orgId, teamId))) return { error: "Team not found." };
  await addTeamMember(teamId, userId);
  revalidatePath("/teams");
  return { ok: true };
}

export async function removeTeamMemberAction(
  teamId: string,
  userId: string,
): Promise<Result> {
  let actor;
  try {
    actor = await requireTeamManager();
  } catch {
    return { error: "You don't have permission to manage teams." };
  }
  if (!(await teamInOrg(actor.orgId, teamId))) return { error: "Team not found." };
  await removeTeamMember(teamId, userId);
  revalidatePath("/teams");
  return { ok: true };
}
