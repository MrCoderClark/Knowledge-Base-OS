"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  checkLoginRateLimit,
  registerLoginFailure,
  registerLoginSuccess,
} from "@/server/ratelimit";
import type { LoginState } from "./auth-types";
import { logSecurityEvent } from "./events";
import { loginWithPassword, normalizeEmail } from "./login";
import { destroyCurrentSession } from "./session";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  rememberMe: z.boolean().optional(),
});

/**
 * Only allow same-site absolute paths as a post-login destination — blocks
 * open redirects to protocol-relative (`//evil`) or external URLs.
 */
function safeNext(raw: FormDataEntryValue | null): string {
  const v = typeof raw === "string" ? raw : "";
  if (v.startsWith("/") && !v.startsWith("//") && !v.startsWith("/\\")) {
    return v;
  }
  return "/";
}

export async function loginAction(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    rememberMe: formData.get("rememberMe") === "on",
  });
  if (!parsed.success) {
    return { error: "Enter a valid email and password." };
  }

  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const userAgent = h.get("user-agent");
  const email = normalizeEmail(parsed.data.email);

  // Rate-limit pre-check (fast reject before any password hashing / DB work).
  const limit = await checkLoginRateLimit({ ip, email });
  if (!limit.ok) {
    await logSecurityEvent({
      type: "SUSPICIOUS_LOGIN",
      ip,
      userAgent,
      metadata: { email, reason: "rate_limited" },
    });
    return { error: "Too many attempts. Please try again later." };
  }

  const result = await loginWithPassword({ ...parsed.data, ip, userAgent });
  if (!result.ok) {
    await registerLoginFailure({ ip, email });
    return {
      error:
        result.reason === "locked"
          ? "Too many attempts. Please try again later."
          : "Invalid email or password.",
    };
  }

  await registerLoginSuccess({ ip, email });
  redirect(safeNext(formData.get("next")));
}

export async function logoutAction(): Promise<void> {
  await destroyCurrentSession();
  redirect("/signin");
}
