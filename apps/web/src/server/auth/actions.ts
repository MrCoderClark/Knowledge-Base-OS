"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { LoginState } from "./auth-types";
import { loginWithPassword } from "./login";
import { destroyCurrentSession } from "./session";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  rememberMe: z.boolean().optional(),
});

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

  const result = await loginWithPassword({ ...parsed.data, ip, userAgent });
  if (!result.ok) {
    return {
      error:
        result.reason === "locked"
          ? "Too many attempts. Please try again later."
          : "Invalid email or password.",
    };
  }

  redirect("/");
}

export async function logoutAction(): Promise<void> {
  await destroyCurrentSession();
  redirect("/signin");
}
