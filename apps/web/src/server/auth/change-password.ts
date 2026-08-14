import { eq } from "drizzle-orm";
import { sendPasswordChangedEmail } from "@/server/email";
import { db } from "@/server/db";
import { users } from "@/server/db/schema";
import { logSecurityEvent } from "./events";
import { hashPassword, verifyPassword } from "./password";
import { validatePassword } from "./policy";
import { revokeOtherUserSessions, rotateCurrentSession } from "./session";

/**
 * Change the signed-in user's password. Reauthenticates by requiring the
 * current password, keeps the current session (rotated), and revokes all others.
 */
export async function changePassword(params: {
  userId: string;
  currentSessionId: string;
  currentPassword: string;
  newPassword: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, params.userId));
  if (!user?.passwordHash) {
    return { ok: false, error: "Unable to change password." };
  }

  // Reauthentication gate.
  if (!(await verifyPassword(user.passwordHash, params.currentPassword))) {
    return { ok: false, error: "Your current password is incorrect." };
  }

  const policy = validatePassword(params.newPassword);
  if (!policy.ok) return { ok: false, error: policy.message };

  if (await verifyPassword(user.passwordHash, params.newPassword)) {
    return {
      ok: false,
      error: "Your new password must be different from your current password.",
    };
  }

  const passwordHash = await hashPassword(params.newPassword);
  await db
    .update(users)
    .set({ passwordHash, updatedAt: new Date() })
    .where(eq(users.id, user.id));

  await revokeOtherUserSessions(user.id, params.currentSessionId);
  await rotateCurrentSession();

  try {
    await sendPasswordChangedEmail({ to: user.email, name: user.name });
  } catch (err) {
    console.error("[change-password] notification email failed", err);
  }
  await logSecurityEvent({ type: "PASSWORD_CHANGED", userId: user.id });

  return { ok: true };
}
