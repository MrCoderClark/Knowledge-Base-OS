import { eq } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

/* ------------------------------------------------------------------ */
/* Mocks — in-memory DB, no Redis/email/cookies side effects.         */
/* ------------------------------------------------------------------ */

const h = vi.hoisted(() => ({ cookieJar: new Map<string, string>() }));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (n: string) =>
      h.cookieJar.has(n) ? { name: n, value: h.cookieJar.get(n)! } : undefined,
    set: (n: string, v: string) => {
      h.cookieJar.set(n, v);
    },
    delete: (n: string) => {
      h.cookieJar.delete(n);
    },
  }),
}));

vi.mock("@/server/db", async () => {
  const harness = await import("@/test/harness");
  return { db: harness.db, schema: harness.schema };
});

vi.mock("@/server/redis", () => ({ redis: {} }));

vi.mock("@/server/ratelimit", () => ({
  checkLoginRateLimit: async () => ({ ok: true }),
  registerLoginFailure: async () => {},
  registerLoginSuccess: async () => {},
  clearLoginLimitsForAccount: async () => {},
  checkResetRateLimit: async () => ({ ok: true }),
  registerResetRequest: async () => {},
}));

vi.mock("@/server/email", () => ({
  sendInviteEmail: vi.fn(async () => {}),
  sendPasswordResetEmail: vi.fn(async () => {}),
  sendPasswordChangedEmail: vi.fn(async () => {}),
}));

/* Imports after mocks (vitest hoists vi.mock above these). */
import { db } from "@/server/db";
import {
  memberships,
  organizations,
  sessions,
  users,
} from "@/server/db/schema";
import * as emailMock from "@/server/email";
import { resetTestDb } from "@/test/harness";
import { changePassword } from "./change-password";
import { acceptInvite, createInvite } from "./invite";
import { loginWithPassword } from "./login";
import { hashPassword } from "./password";
import { requestPasswordReset, resetPassword } from "./reset";
import { createSession, listUserSessions, revokeUserSession } from "./session";

const tokenFromUrl = (url: string) => url.split("/").pop()!;

let orgId: string;

async function seedUser(opts?: { email?: string; password?: string }) {
  const email = opts?.email ?? "user@test.dev";
  const passwordHash = await hashPassword(opts?.password ?? "correct-horse-1");
  const [u] = await db
    .insert(users)
    .values({ email, normalizedEmail: email, passwordHash, status: "active" })
    .returning();
  await db.insert(memberships).values({ orgId, userId: u.id, role: "viewer", status: "active" });
  return u;
}

beforeAll(async () => {
  await resetTestDb();
});

beforeEach(async () => {
  await resetTestDb();
  h.cookieJar.clear();
  vi.clearAllMocks();
  const [org] = await db
    .insert(organizations)
    .values({ name: "Test Org", slug: "test" })
    .returning();
  orgId = org.id;
  // an admin to be the inviter
  await db
    .insert(users)
    .values({ id: "admin-1", email: "admin@test.dev", normalizedEmail: "admin@test.dev", status: "active" });
});

/* ------------------------------------------------------------------ */

describe("invite flow", () => {
  it("creates a pending user, sets password on accept, and blocks token reuse", async () => {
    const res = await createInvite({
      email: "new@test.dev",
      name: "New User",
      role: "editor",
      orgId,
      invitedBy: "admin-1",
    });
    expect("url" in res).toBe(true);
    const token = tokenFromUrl((res as { url: string }).url);

    const [pending] = await db
      .select()
      .from(users)
      .where(eq(users.normalizedEmail, "new@test.dev"));
    expect(pending.status).toBe("invited");
    expect(pending.passwordHash).toBeNull();

    const accepted = await acceptInvite(token, "brand-new-passphrase");
    expect(accepted.ok).toBe(true);

    const [active] = await db
      .select()
      .from(users)
      .where(eq(users.normalizedEmail, "new@test.dev"));
    expect(active.status).toBe("active");
    expect(active.passwordHash).not.toBeNull();

    // Token reuse is rejected.
    const reuse = await acceptInvite(token, "another-passphrase-x");
    expect(reuse.ok).toBe(false);
  });

  it("rejects inviting an already-active user", async () => {
    await seedUser({ email: "dupe@test.dev" });
    const res = await createInvite({
      email: "dupe@test.dev",
      role: "viewer",
      orgId,
      invitedBy: "admin-1",
    });
    expect("error" in res).toBe(true);
  });
});

describe("login", () => {
  it("succeeds with correct credentials and creates a session", async () => {
    const u = await seedUser({ password: "correct-horse-1" });
    const res = await loginWithPassword({ email: "user@test.dev", password: "correct-horse-1" });
    expect(res.ok).toBe(true);
    const rows = await listUserSessions(u.id);
    expect(rows.length).toBe(1);
  });

  it("fails generically for a wrong password", async () => {
    await seedUser({ password: "correct-horse-1" });
    const res = await loginWithPassword({ email: "user@test.dev", password: "wrong" });
    expect(res).toEqual({ ok: false, reason: "invalid" });
  });

  it("does not reveal whether an account exists (unknown email → generic)", async () => {
    const res = await loginWithPassword({ email: "ghost@test.dev", password: "whatever" });
    expect(res).toEqual({ ok: false, reason: "invalid" });
  });

  it("reveals a suspended account only after the correct password", async () => {
    const u = await seedUser({ password: "correct-horse-1" });
    await db
      .update(users)
      .set({ status: "suspended" })
      .where(eq(users.id, u.id));

    // Wrong password stays generic — no enumeration leak.
    const wrong = await loginWithPassword({ email: "user@test.dev", password: "nope" });
    expect(wrong).toEqual({ ok: false, reason: "invalid" });

    // Correct password reveals the suspension.
    const right = await loginWithPassword({
      email: "user@test.dev",
      password: "correct-horse-1",
    });
    expect(right).toEqual({ ok: false, reason: "suspended" });
  });

  it("temporarily locks the account after 5 failures (DB soft-lock)", async () => {
    await seedUser({ password: "correct-horse-1" });
    let last;
    for (let i = 0; i < 5; i++) {
      last = await loginWithPassword({ email: "user@test.dev", password: "bad" });
    }
    expect(last).toEqual({ ok: false, reason: "locked" });
    // Even a correct password is rejected while locked.
    const now = await loginWithPassword({ email: "user@test.dev", password: "correct-horse-1" });
    expect(now).toEqual({ ok: false, reason: "locked" });
  });

  it("issues a fresh session token on each login (fixation-safe)", async () => {
    const u = await seedUser({ password: "correct-horse-1" });
    await loginWithPassword({ email: "user@test.dev", password: "correct-horse-1" });
    h.cookieJar.clear();
    await loginWithPassword({ email: "user@test.dev", password: "correct-horse-1" });
    const rows = await db.select().from(sessions).where(eq(sessions.userId, u.id));
    expect(rows.length).toBe(2);
    expect(rows[0].tokenHash).not.toEqual(rows[1].tokenHash);
  });
});

describe("password reset", () => {
  it("resets the password, revokes sessions, and blocks token reuse", async () => {
    const u = await seedUser({ password: "correct-horse-1" });
    // active session that should be revoked by the reset
    await createSession(u.id, {});

    await requestPasswordReset("user@test.dev");
    const sent = vi.mocked(emailMock.sendPasswordResetEmail).mock.calls[0][0];
    const token = tokenFromUrl(sent.url);

    const res = await resetPassword(token, "a-different-passphrase");
    expect(res.ok).toBe(true);

    const active = await listUserSessions(u.id);
    expect(active.length).toBe(0); // all sessions revoked

    const reuse = await resetPassword(token, "yet-another-passphrase");
    expect(reuse.ok).toBe(false);
  });

  it("rejects resetting to the current password", async () => {
    await seedUser({ password: "correct-horse-1" });
    await requestPasswordReset("user@test.dev");
    const token = tokenFromUrl(
      vi.mocked(emailMock.sendPasswordResetEmail).mock.calls[0][0].url,
    );
    const res = await resetPassword(token, "correct-horse-1");
    expect(res.ok).toBe(false);
  });

  it("stays generic for an unknown email (no token, no throw)", async () => {
    await requestPasswordReset("ghost@test.dev");
    expect(vi.mocked(emailMock.sendPasswordResetEmail)).not.toHaveBeenCalled();
  });
});

describe("sessions & change password", () => {
  it("prevents revoking another user's session (IDOR)", async () => {
    const a = await seedUser({ email: "a@test.dev" });
    const b = await seedUser({ email: "b@test.dev" });
    const bSession = await createSession(b.id, {});

    // A tries to revoke B's session.
    await revokeUserSession(a.id, bSession);
    let active = await listUserSessions(b.id);
    expect(active.length).toBe(1);

    // B revokes its own session.
    await revokeUserSession(b.id, bSession);
    active = await listUserSessions(b.id);
    expect(active.length).toBe(0);
  });

  it("change password requires the current password and revokes other sessions", async () => {
    const u = await seedUser({ password: "correct-horse-1" });
    await createSession(u.id, {}); // another device (cookie now points here)
    const keep = await createSession(u.id, {}); // current device (cookie now here)

    const wrong = await changePassword({
      userId: u.id,
      currentSessionId: keep,
      currentPassword: "not-it",
      newPassword: "a-new-passphrase",
    });
    expect(wrong.ok).toBe(false);

    const ok = await changePassword({
      userId: u.id,
      currentSessionId: keep,
      currentPassword: "correct-horse-1",
      newPassword: "a-new-passphrase",
    });
    expect(ok.ok).toBe(true);

    // The kept session survives; the other is revoked.
    const active = await listUserSessions(u.id);
    expect(active.some((s) => s.id === keep)).toBe(true);
    expect(active.length).toBe(1);
  });
});
