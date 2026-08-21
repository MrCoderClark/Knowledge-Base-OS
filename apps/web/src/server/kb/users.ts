import { and, eq } from "drizzle-orm";
import { logSecurityEvent } from "@/server/auth/events";
import { revokeAllUserSessions } from "@/server/auth/session";
import { db } from "@/server/db";
import { memberships, users } from "@/server/db/schema";
import { sendAccountSuspendedEmail } from "@/server/email";
import { clearLoginLimitsForAccount } from "@/server/ratelimit";
import type { OrgRole } from "@/server/authz";

export type ManagedUser = {
  userId: string;
  name: string | null;
  email: string;
  role: OrgRole;
  /** Account-level status (gates login + session validity). */
  status: "invited" | "active" | "suspended";
  /** Org membership status. */
  membershipStatus: "invited" | "active" | "suspended";
  lockedUntil: Date | null;
  lastLoginAt: Date | null;
};

/** Every member of an org (any status) for the Users admin table. */
export function listManagedUsers(orgId: string): Promise<ManagedUser[]> {
  return db
    .select({
      userId: users.id,
      name: users.name,
      email: users.email,
      role: memberships.role,
      status: users.status,
      membershipStatus: memberships.status,
      lockedUntil: users.lockedUntil,
      lastLoginAt: users.lastLoginAt,
    })
    .from(memberships)
    .innerJoin(users, eq(memberships.userId, users.id))
    .where(eq(memberships.orgId, orgId))
    .orderBy(users.name);
}

/**
 * Suspend a member: flip BOTH the account status and the org membership to
 * `suspended`, then revoke every session so access is cut on the next request.
 * (Account status is what the login + session guards check — auth review R3.)
 */
export async function suspendMember(orgId: string, userId: string): Promise<void> {
  const now = new Date();
  const [target] = await db
    .update(users)
    .set({ status: "suspended", updatedAt: now })
    .where(eq(users.id, userId))
    .returning({ email: users.email, name: users.name });
  await db
    .update(memberships)
    .set({ status: "suspended" })
    .where(and(eq(memberships.orgId, orgId), eq(memberships.userId, userId)));
  await revokeAllUserSessions(userId);
  await logSecurityEvent({
    type: "USER_SUSPENDED",
    userId,
    orgId,
    metadata: { action: "suspend" },
  });

  // Notify the user (best-effort — never block the action on email delivery).
  if (target) {
    try {
      await sendAccountSuspendedEmail({ to: target.email, name: target.name });
    } catch (err) {
      console.error("[suspend] failed to send suspension email", err);
    }
  }
}

/** Re-activate a suspended member (restores account + membership to active). */
export async function reactivateMember(
  orgId: string,
  userId: string,
): Promise<void> {
  const now = new Date();
  await db
    .update(users)
    .set({ status: "active", updatedAt: now })
    .where(eq(users.id, userId));
  await db
    .update(memberships)
    .set({ status: "active" })
    .where(and(eq(memberships.orgId, orgId), eq(memberships.userId, userId)));
}

/**
 * Remove a member from the org: delete the membership and revoke their
 * sessions. The user row is left intact so historical authorship (createdBy,
 * activity) is preserved; without a membership `getActor` returns null.
 */
export async function removeMember(orgId: string, userId: string): Promise<void> {
  await db
    .delete(memberships)
    .where(and(eq(memberships.orgId, orgId), eq(memberships.userId, userId)));
  await revokeAllUserSessions(userId);
}

/**
 * Unlock a locked account immediately. Clears the persistent Postgres lock
 * (`lockedUntil` + `failedLoginAttempts`) AND the Redis per-account login
 * limiter keys — otherwise Redis keeps throttling after the DB lock is gone.
 */
export async function unlockMember(
  orgId: string,
  userId: string,
): Promise<void> {
  // Scope the lookup to the org and read the normalized email — the Redis
  // limiter keys are built from the normalized (lowercased) email.
  const [member] = await db
    .select({ normalizedEmail: users.normalizedEmail })
    .from(memberships)
    .innerJoin(users, eq(memberships.userId, users.id))
    .where(and(eq(memberships.orgId, orgId), eq(memberships.userId, userId)));
  if (!member) return;

  await db
    .update(users)
    .set({ lockedUntil: null, failedLoginAttempts: 0, updatedAt: new Date() })
    .where(eq(users.id, userId));
  // normalizedEmail is nullable; only clear Redis when we have a key to match.
  if (member.normalizedEmail) {
    await clearLoginLimitsForAccount(member.normalizedEmail);
  }
  await logSecurityEvent({ type: "ACCOUNT_UNLOCKED", userId, orgId });
}
