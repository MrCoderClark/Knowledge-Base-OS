import { and, desc, eq, gt, isNull } from "drizzle-orm";
import { cookies } from "next/headers";
import { db } from "@/server/db";
import { sessions, users } from "@/server/db/schema";
import { isProd } from "@/server/env";
import { generateToken, hashToken } from "./tokens";

/* Cookie: __Host- prefix in prod (requires Secure+https); plain name in dev. */
const COOKIE_NAME = isProd ? "__Host-kb_session" : "kb_session";

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const IDLE_TIMEOUT = 8 * HOUR; // inactivity window
const ABSOLUTE_REMEMBER = 30 * DAY; // "remember me"
const ABSOLUTE_DEFAULT = 1 * DAY; // normal
const LAST_SEEN_THROTTLE = 1 * MINUTE; // avoid write amplification

export type SessionUser = {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
};

type CreateSessionOpts = {
  ip?: string | null;
  userAgent?: string | null;
  rememberMe?: boolean;
};

/**
 * Create a fresh session (always new — fixation-safe) and set the cookie.
 * Must be called from a Server Action or Route Handler (it writes a cookie).
 * Returns the session id.
 */
export async function createSession(
  userId: string,
  opts: CreateSessionOpts = {},
): Promise<string> {
  const token = generateToken();
  const tokenHash = hashToken(token);
  const now = Date.now();
  const absolute = opts.rememberMe ? ABSOLUTE_REMEMBER : ABSOLUTE_DEFAULT;
  const expiresAt = new Date(now + absolute);

  const [row] = await db
    .insert(sessions)
    .values({
      userId,
      tokenHash,
      expiresAt,
      ip: opts.ip ?? null,
      userAgent: opts.userAgent ?? null,
    })
    .returning({ id: sessions.id });

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });

  return row.id;
}

/** Read + validate the current session; null if absent/invalid/expired. */
export async function getCurrentSession(): Promise<{
  sessionId: string;
  user: SessionUser;
} | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;

  const tokenHash = hashToken(token);
  const now = new Date();

  const [row] = await db
    .select({
      sessionId: sessions.id,
      lastSeenAt: sessions.lastSeenAt,
      userId: users.id,
      name: users.name,
      email: users.email,
      image: users.image,
      status: users.status,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(
      and(
        eq(sessions.tokenHash, tokenHash),
        isNull(sessions.revokedAt),
        gt(sessions.expiresAt, now),
      ),
    );

  if (!row) return null;
  if (row.status !== "active") return null;

  // Idle timeout.
  if (now.getTime() - row.lastSeenAt.getTime() > IDLE_TIMEOUT) return null;

  // Throttled last-seen bump (DB write only; no cookie write here).
  if (now.getTime() - row.lastSeenAt.getTime() > LAST_SEEN_THROTTLE) {
    await db
      .update(sessions)
      .set({ lastSeenAt: now })
      .where(eq(sessions.id, row.sessionId));
  }

  return {
    sessionId: row.sessionId,
    user: {
      id: row.userId,
      name: row.name,
      email: row.email,
      image: row.image,
    },
  };
}

/** Revoke a single session by id. */
export async function revokeSession(sessionId: string): Promise<void> {
  await db
    .update(sessions)
    .set({ revokedAt: new Date() })
    .where(and(eq(sessions.id, sessionId), isNull(sessions.revokedAt)));
}

/** Revoke every active session for a user (e.g. on password change). */
export async function revokeAllUserSessions(userId: string): Promise<void> {
  await db
    .update(sessions)
    .set({ revokedAt: new Date() })
    .where(and(eq(sessions.userId, userId), isNull(sessions.revokedAt)));
}

/** Log out: revoke current session and clear the cookie. */
export async function destroyCurrentSession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (token) {
    await db
      .update(sessions)
      .set({ revokedAt: new Date() })
      .where(eq(sessions.tokenHash, hashToken(token)));
  }
  cookieStore.delete(COOKIE_NAME);
}

export type ActiveSession = {
  id: string;
  ip: string | null;
  userAgent: string | null;
  createdAt: Date;
  lastSeenAt: Date;
};

/** List a user's active (non-revoked, non-expired) sessions, newest activity first. */
export async function listUserSessions(userId: string): Promise<ActiveSession[]> {
  const now = new Date();
  return db
    .select({
      id: sessions.id,
      ip: sessions.ip,
      userAgent: sessions.userAgent,
      createdAt: sessions.createdAt,
      lastSeenAt: sessions.lastSeenAt,
    })
    .from(sessions)
    .where(
      and(
        eq(sessions.userId, userId),
        isNull(sessions.revokedAt),
        gt(sessions.expiresAt, now),
      ),
    )
    .orderBy(desc(sessions.lastSeenAt));
}

/** Revoke a single session, scoped to its owner (prevents cross-user IDOR). */
export async function revokeUserSession(
  userId: string,
  sessionId: string,
): Promise<void> {
  await db
    .update(sessions)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(sessions.id, sessionId),
        eq(sessions.userId, userId),
        isNull(sessions.revokedAt),
      ),
    );
}

/** Revoke all of a user's sessions except the one to keep. */
export async function revokeOtherUserSessions(
  userId: string,
  keepSessionId: string,
): Promise<void> {
  const rows = await db
    .select({ id: sessions.id })
    .from(sessions)
    .where(and(eq(sessions.userId, userId), isNull(sessions.revokedAt)));
  const now = new Date();
  for (const r of rows) {
    if (r.id !== keepSessionId) {
      await db
        .update(sessions)
        .set({ revokedAt: now })
        .where(eq(sessions.id, r.id));
    }
  }
}

/**
 * Rotate the current session's token + refresh its authenticated timestamp
 * (called after a password change / security-sensitive event).
 */
export async function rotateCurrentSession(): Promise<void> {
  const cookieStore = await cookies();
  const oldToken = cookieStore.get(COOKIE_NAME)?.value;
  if (!oldToken) return;

  const newToken = generateToken();
  const now = new Date();
  const [row] = await db
    .update(sessions)
    .set({ tokenHash: hashToken(newToken), lastAuthenticatedAt: now })
    .where(eq(sessions.tokenHash, hashToken(oldToken)))
    .returning({ expiresAt: sessions.expiresAt });
  if (!row) return;

  cookieStore.set(COOKIE_NAME, newToken, {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    path: "/",
    expires: row.expiresAt,
  });
}
