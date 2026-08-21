"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/server/authz";
import { countAdmins, getMemberRole } from "./members";
import {
  reactivateMember,
  removeMember,
  suspendMember,
  unlockMember,
} from "./users";

type Result = { ok?: true; error?: string };

/**
 * Guard a "downgrade" action (suspend / remove) against footguns: you can't
 * target your own account, and you can't drop the org below one active admin.
 */
async function guardDowngrade(
  orgId: string,
  actorUserId: string,
  targetUserId: string,
): Promise<string | null> {
  if (targetUserId === actorUserId) {
    return "You can't do that to your own account.";
  }
  const role = await getMemberRole(orgId, targetUserId);
  if (!role) return "Member not found.";
  const isAdmin = role === "owner" || role === "admin";
  if (isAdmin && (await countAdmins(orgId)) <= 1) {
    return "The organization must keep at least one admin.";
  }
  return null;
}

export async function suspendUserAction(userId: string): Promise<Result> {
  let actor;
  try {
    actor = await requirePermission("member:manage");
  } catch {
    return { error: "You don't have permission to do this." };
  }
  const err = await guardDowngrade(actor.orgId, actor.userId, userId);
  if (err) return { error: err };

  await suspendMember(actor.orgId, userId);
  revalidatePath("/users");
  return { ok: true };
}

export async function reactivateUserAction(userId: string): Promise<Result> {
  let actor;
  try {
    actor = await requirePermission("member:manage");
  } catch {
    return { error: "You don't have permission to do this." };
  }
  const role = await getMemberRole(actor.orgId, userId);
  if (!role) return { error: "Member not found." };

  await reactivateMember(actor.orgId, userId);
  revalidatePath("/users");
  return { ok: true };
}

export async function removeUserAction(userId: string): Promise<Result> {
  let actor;
  try {
    actor = await requirePermission("member:manage");
  } catch {
    return { error: "You don't have permission to do this." };
  }
  const err = await guardDowngrade(actor.orgId, actor.userId, userId);
  if (err) return { error: err };

  await removeMember(actor.orgId, userId);
  revalidatePath("/users");
  return { ok: true };
}

export async function unlockUserAction(userId: string): Promise<Result> {
  let actor;
  try {
    actor = await requirePermission("member:manage");
  } catch {
    return { error: "You don't have permission to do this." };
  }
  const role = await getMemberRole(actor.orgId, userId);
  if (!role) return { error: "Member not found." };

  await unlockMember(actor.orgId, userId);
  revalidatePath("/users");
  return { ok: true };
}
