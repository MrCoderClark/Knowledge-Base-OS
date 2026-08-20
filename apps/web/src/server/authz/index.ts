import { eq } from "drizzle-orm";
import { getCurrentSession } from "@/server/auth/session";
import { db } from "@/server/db";
import { memberships } from "@/server/db/schema";
import { hasPermission, type Permission } from "./permissions";

export type OrgRole = "owner" | "admin" | "editor" | "viewer";

export { hasPermission };
export type { Permission };

export type Actor = {
  userId: string;
  email: string;
  name: string | null;
  orgId: string;
  role: OrgRole;
  /** Per-member permission grants layered on top of the role. */
  grants: Permission[];
};

/** Current signed-in user resolved with their org membership + role + grants. */
export async function getActor(): Promise<Actor | null> {
  const session = await getCurrentSession();
  if (!session) return null;
  const [m] = await db
    .select()
    .from(memberships)
    .where(eq(memberships.userId, session.user.id));
  if (!m || m.status !== "active") return null;
  return {
    userId: session.user.id,
    email: session.user.email,
    name: session.user.name,
    orgId: m.orgId,
    role: m.role,
    grants: (m.extraPermissions ?? []) as Permission[],
  };
}

export function isAdmin(role: OrgRole): boolean {
  return role === "owner" || role === "admin";
}

/**
 * Effective permission check — true if the actor holds `permission` by role
 * OR by an individual grant. Use this for access decisions; prefer it over the
 * role-only `hasPermission` wherever grants should count.
 */
export function can(
  actor: Pick<Actor, "role" | "grants">,
  permission: Permission,
): boolean {
  return hasPermission(actor.role, permission) || actor.grants.includes(permission);
}

/** Throws if the current user is not an org admin/owner. */
export async function requireAdmin(): Promise<Actor> {
  const actor = await getActor();
  if (!actor || !isAdmin(actor.role)) {
    throw new Error("Forbidden");
  }
  return actor;
}

/** Throws unless the current user has `permission` (by role or grant). */
export async function requirePermission(permission: Permission): Promise<Actor> {
  const actor = await getActor();
  if (!actor || !can(actor, permission)) {
    throw new Error("Forbidden");
  }
  return actor;
}
