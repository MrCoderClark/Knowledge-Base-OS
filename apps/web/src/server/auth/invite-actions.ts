"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdmin } from "@/server/authz";
import { sendInviteEmail } from "@/server/email";
import type { AcceptState, InviteState } from "./auth-types";
import { logSecurityEvent } from "./events";
import { acceptInvite, createInvite } from "./invite";
import { normalizeEmail } from "./login";
import { validatePassword } from "./policy";
import { createSession } from "./session";

const inviteSchema = z.object({
  email: z.string().email(),
  name: z.string().trim().optional(),
  role: z.enum(["admin", "editor", "viewer"]),
});

export async function inviteUserAction(
  _prev: InviteState,
  formData: FormData,
): Promise<InviteState> {
  let actor;
  try {
    actor = await requireAdmin();
  } catch {
    return { error: "You are not allowed to invite users." };
  }

  const parsed = inviteSchema.safeParse({
    email: formData.get("email"),
    name: (formData.get("name") as string) || undefined,
    role: formData.get("role"),
  });
  if (!parsed.success) return { error: "Enter a valid email and role." };

  const result = await createInvite({
    email: parsed.data.email,
    name: parsed.data.name ?? null,
    role: parsed.data.role,
    orgId: actor.orgId,
    invitedBy: actor.userId,
  });
  if ("error" in result) return { error: result.error };

  try {
    await sendInviteEmail({
      to: parsed.data.email,
      name: parsed.data.name,
      url: result.url,
    });
  } catch (err) {
    console.error("[invite] email send failed", err);
    return { error: "Invite created, but the email failed to send. Check SMTP settings." };
  }

  await logSecurityEvent({
    type: "ACCOUNT_INVITED",
    userId: actor.userId,
    orgId: actor.orgId,
    metadata: { email: normalizeEmail(parsed.data.email), role: parsed.data.role },
  });

  revalidatePath("/users");
  return { success: `Invitation sent to ${parsed.data.email}.` };
}

export async function acceptInviteAction(
  _prev: AcceptState,
  formData: FormData,
): Promise<AcceptState> {
  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (!token) return { error: "Missing invite token." };
  if (password !== confirm) return { error: "Passwords do not match." };

  const policy = validatePassword(password);
  if (!policy.ok) return { error: policy.message };

  const result = await acceptInvite(token, password);
  if (!result.ok) return { error: result.error };

  // Auto-login the freshly activated account.
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const userAgent = h.get("user-agent");
  await createSession(result.userId, { ip, userAgent });

  await logSecurityEvent({
    type: "INVITE_ACCEPTED",
    userId: result.userId,
    ip,
    userAgent,
  });

  redirect("/");
}
