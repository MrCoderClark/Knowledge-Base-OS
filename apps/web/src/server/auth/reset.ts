import { and, eq, isNull } from "drizzle-orm";
import {
  sendPasswordChangedEmail,
  sendPasswordResetEmail,
} from "@/server/email";
import { db } from "@/server/db";
import { credentialTokens, users } from "@/server/db/schema";
import { env } from "@/server/env";
import { clearLoginLimitsForAccount } from "@/server/ratelimit";
import { normalizeEmail } from "./login";
import { hashPassword, verifyPassword } from "./password";
import { revokeAllUserSessions } from "./session";
import { generateToken, hashToken } from "./tokens";

const RESET_TTL_MS = 30 * 60 * 1000; // 30 min

/**
 * Issue a reset token + email it — but only for accounts that can actually
 * sign in. Callers must treat this as fire-and-forget and always return a
 * generic response (no account-existence disclosure).
 */
export async function requestPasswordReset(emailInput: string): Promise<void> {
  const email = normalizeEmail(emailInput);
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.normalizedEmail, email));
  if (!user || !user.passwordHash || user.status !== "active") return;

  const token = generateToken();
  await db.insert(credentialTokens).values({
    userId: user.id,
    purpose: "password_reset",
    tokenHash: hashToken(token),
    expiresAt: new Date(Date.now() + RESET_TTL_MS),
  });

  // Fire-and-forget: awaiting the SMTP send would make responses for real
  // accounts slower than for unknown ones, leaking account existence via timing.
  void sendPasswordResetEmail({
    to: user.email,
    name: user.name,
    url: `${env.APP_URL}/reset-password/${token}`,
  }).catch((err) => console.error("[reset] request email failed", err));
}

/**
 * Consume a reset token and set a new password. Atomic one-time consume;
 * revokes ALL of the user's sessions and clears lock/rate-limit state.
 */
export async function resetPassword(
  token: string,
  password: string,
): Promise<{ ok: true; userId: string } | { ok: false; error: string }> {
  const now = new Date();
  const [row] = await db
    .select()
    .from(credentialTokens)
    .where(
      and(
        eq(credentialTokens.tokenHash, hashToken(token)),
        eq(credentialTokens.purpose, "password_reset"),
      ),
    );

  if (!row || row.consumedAt || row.expiresAt < now) {
    return { ok: false, error: "This reset link is invalid or has expired." };
  }

  // Reject reusing the current password (checked before consuming the token so
  // a rejection doesn't invalidate the reset link).
  const [current] = await db
    .select({ passwordHash: users.passwordHash })
    .from(users)
    .where(eq(users.id, row.userId));
  if (current?.passwordHash && (await verifyPassword(current.passwordHash, password))) {
    return {
      ok: false,
      error: "Your new password must be different from your current password.",
    };
  }

  const consumed = await db
    .update(credentialTokens)
    .set({ consumedAt: now })
    .where(
      and(eq(credentialTokens.id, row.id), isNull(credentialTokens.consumedAt)),
    )
    .returning({ id: credentialTokens.id });
  if (consumed.length === 0) {
    return { ok: false, error: "This reset link has already been used." };
  }

  const passwordHash = await hashPassword(password);
  const [user] = await db
    .update(users)
    .set({
      passwordHash,
      failedLoginAttempts: 0,
      lockedUntil: null,
      updatedAt: now,
    })
    .where(eq(users.id, row.userId))
    .returning({
      id: users.id,
      email: users.email,
      name: users.name,
      normalizedEmail: users.normalizedEmail,
    });

  // Invalidate every existing session + clear Redis login throttles.
  await revokeAllUserSessions(row.userId);
  if (user?.normalizedEmail) {
    await clearLoginLimitsForAccount(user.normalizedEmail);
  }

  if (user) {
    try {
      await sendPasswordChangedEmail({ to: user.email, name: user.name });
    } catch (err) {
      console.error("[reset] notification email failed", err);
    }
  }

  return { ok: true, userId: row.userId };
}
