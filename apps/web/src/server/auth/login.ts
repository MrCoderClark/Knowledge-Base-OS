import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { users } from "@/server/db/schema";
import { logSecurityEvent } from "./events";
import { hashPassword, needsRehash, verifyPassword } from "./password";
import { createSession } from "./session";

/** Precomputed Argon2id hash so the no-user path costs the same as a real verify. */
const DUMMY_HASH =
  "$argon2id$v=19$m=19456,t=2,p=1$z01+V0Rm4yMdZ9L5OjlJRg$2PXcZn/m5cQLdNe4obRc/8oeNZQEwLfh0RFTE43fBfY";

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_DURATION_MS = 15 * 60 * 1000; // temporary soft-lock (not indefinite)

export type LoginInput = {
  email: string;
  password: string;
  rememberMe?: boolean;
  ip?: string | null;
  userAgent?: string | null;
};

export type LoginResult =
  | { ok: true }
  | { ok: false; reason: "invalid" | "locked" };

/** Normalize an email for lookup/storage (lowercase + trim). */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Authenticate an email/password and, on success, create a session.
 * Always returns a generic failure — never reveals whether the account exists.
 */
export async function loginWithPassword(input: LoginInput): Promise<LoginResult> {
  const email = normalizeEmail(input.email);
  const now = new Date();

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.normalizedEmail, email));

  // Constant-time: always run a verify, even when the user is missing.
  const hashToCheck = user?.passwordHash ?? DUMMY_HASH;
  const passwordOk = await verifyPassword(hashToCheck, input.password);

  if (!user || !user.passwordHash) {
    await logSecurityEvent({
      type: "LOGIN_FAILURE",
      ip: input.ip,
      userAgent: input.userAgent,
      metadata: { email, reason: "unknown_account" },
    });
    return { ok: false, reason: "invalid" };
  }

  // Temporary lock / non-active status.
  if (user.lockedUntil && user.lockedUntil > now) {
    await logSecurityEvent({
      type: "LOGIN_FAILURE",
      userId: user.id,
      ip: input.ip,
      userAgent: input.userAgent,
      metadata: { reason: "locked" },
    });
    return { ok: false, reason: "locked" };
  }
  if (user.status !== "active") {
    return { ok: false, reason: "invalid" };
  }

  if (!passwordOk) {
    const attempts = user.failedLoginAttempts + 1;
    const locked = attempts >= MAX_FAILED_ATTEMPTS;
    await db
      .update(users)
      .set({
        failedLoginAttempts: locked ? 0 : attempts,
        lockedUntil: locked ? new Date(now.getTime() + LOCK_DURATION_MS) : null,
        updatedAt: now,
      })
      .where(eq(users.id, user.id));
    await logSecurityEvent({
      type: locked ? "ACCOUNT_LOCKED" : "LOGIN_FAILURE",
      userId: user.id,
      ip: input.ip,
      userAgent: input.userAgent,
      metadata: { reason: "bad_password" },
    });
    return { ok: false, reason: locked ? "locked" : "invalid" };
  }

  // Success — transparent rehash if the stored hash is legacy/outdated.
  const patch: Partial<typeof users.$inferInsert> = {
    failedLoginAttempts: 0,
    lockedUntil: null,
    lastLoginAt: now,
    updatedAt: now,
  };
  if (needsRehash(user.passwordHash)) {
    patch.passwordHash = await hashPassword(input.password);
  }
  await db.update(users).set(patch).where(eq(users.id, user.id));

  await createSession(user.id, {
    ip: input.ip,
    userAgent: input.userAgent,
    rememberMe: input.rememberMe,
  });

  await logSecurityEvent({
    type: "LOGIN_SUCCESS",
    userId: user.id,
    ip: input.ip,
    userAgent: input.userAgent,
  });

  return { ok: true };
}
