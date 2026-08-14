import { eq } from "drizzle-orm";
import { getCurrentSession } from "@/server/auth/session";
import { db } from "@/server/db";
import { memberships } from "@/server/db/schema";

export type OrgRole = "owner" | "admin" | "editor" | "viewer";

export type Actor = {
  userId: string;
  email: string;
  name: string | null;
  orgId: string;
  role: OrgRole;
};

/** Current signed-in user resolved with their org membership + role. */
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
  };
}

export function isAdmin(role: OrgRole): boolean {
  return role === "owner" || role === "admin";
}

/** Throws if the current user is not an org admin/owner. */
export async function requireAdmin(): Promise<Actor> {
  const actor = await getActor();
  if (!actor || !isAdmin(actor.role)) {
    throw new Error("Forbidden");
  }
  return actor;
}
