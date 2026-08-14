import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/server/db";
import { credentialTokens, memberships, users } from "@/server/db/schema";
import { env } from "@/server/env";
import type { OrgRole } from "@/server/authz";
import { normalizeEmail } from "./login";
import { hashPassword } from "./password";
import { generateToken, hashToken } from "./tokens";

const INVITE_TTL_MS = 72 * 60 * 60 * 1000; // 72h

type CreateInviteParams = {
  email: string;
  name?: string | null;
  role: Exclude<OrgRole, "owner">;
  orgId: string;
  invitedBy: string;
};

/**
 * Create (or re-invite) a user and issue a one-time invite token. Returns the
 * set-password URL for the caller to email. Only the token hash is stored.
 */
export async function createInvite(
  params: CreateInviteParams,
): Promise<{ url: string } | { error: string }> {
  const email = normalizeEmail(params.email);

  const [existing] = await db
    .select()
    .from(users)
    .where(eq(users.normalizedEmail, email));

  let userId: string;
  if (existing) {
    if (existing.passwordHash) {
      return { error: "A user with that email already exists." };
    }
    userId = existing.id; // pending invite — re-issue
  } else {
    const [created] = await db
      .insert(users)
      .values({
        email: params.email.trim(),
        normalizedEmail: email,
        name: params.name ?? null,
        status: "invited",
      })
      .returning({ id: users.id });
    userId = created.id;
  }

  const [membership] = await db
    .select()
    .from(memberships)
    .where(and(eq(memberships.userId, userId), eq(memberships.orgId, params.orgId)));
  if (!membership) {
    await db.insert(memberships).values({
      orgId: params.orgId,
      userId,
      role: params.role,
      status: "invited",
      invitedBy: params.invitedBy,
    });
  }

  const token = generateToken();
  await db.insert(credentialTokens).values({
    userId,
    purpose: "invite",
    tokenHash: hashToken(token),
    expiresAt: new Date(Date.now() + INVITE_TTL_MS),
    createdBy: params.invitedBy,
  });

  return { url: `${env.APP_URL}/invite/${token}` };
}

/**
 * Consume an invite token and set the account's initial password. Atomic
 * one-time consumption guards against token reuse/races.
 */
export async function acceptInvite(
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
        eq(credentialTokens.purpose, "invite"),
      ),
    );

  if (!row || row.consumedAt || row.expiresAt < now) {
    return { ok: false, error: "This invite link is invalid or has expired." };
  }

  const consumed = await db
    .update(credentialTokens)
    .set({ consumedAt: now })
    .where(
      and(eq(credentialTokens.id, row.id), isNull(credentialTokens.consumedAt)),
    )
    .returning({ id: credentialTokens.id });
  if (consumed.length === 0) {
    return { ok: false, error: "This invite link has already been used." };
  }

  const passwordHash = await hashPassword(password);
  await db
    .update(users)
    .set({ passwordHash, status: "active", emailVerifiedAt: now, updatedAt: now })
    .where(eq(users.id, row.userId));
  await db
    .update(memberships)
    .set({ status: "active" })
    .where(eq(memberships.userId, row.userId));

  return { ok: true, userId: row.userId };
}
