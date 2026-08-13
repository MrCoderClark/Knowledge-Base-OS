import { db } from "@/server/db";
import { securityEvents } from "@/server/db/schema";

/**
 * Structured security/audit events. Persisted to `security_events` and echoed
 * to the app log. NEVER pass secrets, tokens, passwords, or recovery codes in
 * `metadata`.
 */
export type SecurityEventType =
  | "LOGIN_SUCCESS"
  | "LOGIN_FAILURE"
  | "LOGOUT"
  | "ACCOUNT_INVITED"
  | "INVITE_ACCEPTED"
  | "PASSWORD_CHANGED"
  | "PASSWORD_RESET_REQUESTED"
  | "PASSWORD_RESET_COMPLETED"
  | "ACCOUNT_LOCKED"
  | "ACCOUNT_UNLOCKED"
  | "SESSION_CREATED"
  | "SESSION_REVOKED"
  | "ALL_SESSIONS_REVOKED"
  | "ROLE_CHANGED"
  | "USER_SUSPENDED"
  | "SUSPICIOUS_LOGIN"
  // Reserved for later phases:
  | "MFA_ENABLED"
  | "MFA_DISABLED"
  | "MFA_FAILURE"
  | "OAUTH_ACCOUNT_LINKED"
  | "OAUTH_ACCOUNT_UNLINKED";

export type SecurityEventInput = {
  type: SecurityEventType;
  userId?: string | null;
  orgId?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  metadata?: Record<string, unknown> | null;
};

/** Mask an IP for privacy (drop the last octet / last v6 group). */
export function maskIp(ip: string | null | undefined): string | null {
  if (!ip) return null;
  if (ip.includes(".")) return ip.replace(/\.\d+$/, ".0");
  if (ip.includes(":")) return ip.replace(/[0-9a-fA-F]+$/, "0");
  return ip;
}

export async function logSecurityEvent(input: SecurityEventInput): Promise<void> {
  try {
    await db.insert(securityEvents).values({
      type: input.type,
      userId: input.userId ?? null,
      orgId: input.orgId ?? null,
      ip: maskIp(input.ip),
      userAgent: input.userAgent ?? null,
      metadata: input.metadata ?? null,
    });
  } catch (err) {
    // Audit logging must never break the request path; surface via app log.
    console.error("[security-event] failed to persist", input.type, err);
  }
}
