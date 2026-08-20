"use server";

import { revalidatePath } from "next/cache";
import { type OrgRole, requirePermission } from "@/server/authz";
import { isPermission } from "@/server/authz/permissions";
import {
  countAdmins,
  getMemberRole,
  updateMemberGrants,
  updateMemberRole,
} from "./members";

const ROLES: OrgRole[] = ["owner", "admin", "editor", "viewer"];

function isRole(v: string): v is OrgRole {
  return (ROLES as string[]).includes(v);
}

/** Admin — change a member's role (guards against removing the last admin). */
export async function setMemberRoleAction(
  userId: string,
  role: string,
): Promise<{ ok?: true; error?: string }> {
  let actor;
  try {
    actor = await requirePermission("permissions:manage");
  } catch {
    return { error: "You don't have permission to do this." };
  }
  if (!isRole(role)) return { error: "Invalid role." };

  const current = await getMemberRole(actor.orgId, userId);
  if (!current) return { error: "Member not found." };

  const wasAdmin = current === "owner" || current === "admin";
  const willBeAdmin = role === "owner" || role === "admin";
  if (wasAdmin && !willBeAdmin && (await countAdmins(actor.orgId)) <= 1) {
    return { error: "The organization must keep at least one admin." };
  }

  await updateMemberRole(actor.orgId, userId, role);
  revalidatePath("/permissions");
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Admin — set a member's individual permission grants (replaces the set). */
export async function setMemberGrantsAction(
  userId: string,
  grants: string[],
): Promise<{ ok?: true; error?: string }> {
  let actor;
  try {
    actor = await requirePermission("permissions:manage");
  } catch {
    return { error: "You don't have permission to do this." };
  }
  const clean = [...new Set(grants.filter(isPermission))];
  await updateMemberGrants(actor.orgId, userId, clean);
  revalidatePath("/permissions");
  revalidatePath("/", "layout");
  return { ok: true };
}
