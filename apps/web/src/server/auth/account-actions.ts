"use server";

import { revalidatePath } from "next/cache";
import type { ChangePasswordState } from "./auth-types";
import { changePassword } from "./change-password";
import { logSecurityEvent } from "./events";
import {
  getCurrentSession,
  revokeOtherUserSessions,
  revokeUserSession,
} from "./session";

export async function changePasswordAction(
  _prev: ChangePasswordState,
  formData: FormData,
): Promise<ChangePasswordState> {
  const session = await getCurrentSession();
  if (!session) return { error: "You must be signed in." };

  const currentPassword = String(formData.get("currentPassword") ?? "");
  const newPassword = String(formData.get("newPassword") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  if (newPassword !== confirm) {
    return { error: "New passwords do not match." };
  }

  const result = await changePassword({
    userId: session.user.id,
    currentSessionId: session.sessionId,
    currentPassword,
    newPassword,
  });
  if (!result.ok) return { error: result.error };

  // Note: no revalidatePath here — this action rotates the current session
  // cookie, and re-rendering in the same pass could read the pre-rotation
  // cookie and log the user out. The success message is enough; the sessions
  // list refreshes on next navigation.
  return { success: "Password updated. Your other sessions were signed out." };
}

export async function revokeSessionAction(formData: FormData): Promise<void> {
  const session = await getCurrentSession();
  if (!session) return;
  const sessionId = String(formData.get("sessionId") ?? "");
  if (!sessionId || sessionId === session.sessionId) return; // don't self-revoke here

  await revokeUserSession(session.user.id, sessionId);
  await logSecurityEvent({ type: "SESSION_REVOKED", userId: session.user.id });
  revalidatePath("/account/security");
}

export async function revokeOtherSessionsAction(): Promise<void> {
  const session = await getCurrentSession();
  if (!session) return;

  await revokeOtherUserSessions(session.user.id, session.sessionId);
  await logSecurityEvent({ type: "ALL_SESSIONS_REVOKED", userId: session.user.id });
  revalidatePath("/account/security");
}
