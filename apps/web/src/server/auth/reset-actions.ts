"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  checkResetRateLimit,
  registerResetRequest,
} from "@/server/ratelimit";
import type { ForgotState, ResetState } from "./auth-types";
import { logSecurityEvent } from "./events";
import { normalizeEmail } from "./login";
import { validatePassword } from "./policy";
import { requestPasswordReset, resetPassword } from "./reset";

const forgotSchema = z.object({ email: z.string().email() });

export async function forgotPasswordAction(
  _prev: ForgotState,
  formData: FormData,
): Promise<ForgotState> {
  // Always return the same generic result — never reveal account existence.
  const generic: ForgotState = { sent: true };

  const parsed = forgotSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) return generic;

  const email = normalizeEmail(parsed.data.email);
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;

  const rl = await checkResetRateLimit({ ip, email });
  if (rl.ok) {
    await registerResetRequest({ ip, email });
    await logSecurityEvent({
      type: "PASSWORD_RESET_REQUESTED",
      ip,
      metadata: { email },
    });
    try {
      await requestPasswordReset(parsed.data.email);
    } catch (err) {
      console.error("[reset] request email failed", err);
    }
  }

  return generic;
}

export async function resetPasswordAction(
  _prev: ResetState,
  formData: FormData,
): Promise<ResetState> {
  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (!token) return { error: "Missing reset token." };
  if (password !== confirm) return { error: "Passwords do not match." };

  const policy = validatePassword(password);
  if (!policy.ok) return { error: policy.message };

  const result = await resetPassword(token, password);
  if (!result.ok) return { error: result.error };

  await logSecurityEvent({
    type: "PASSWORD_RESET_COMPLETED",
    userId: result.userId,
  });

  redirect("/signin?reset=1");
}
