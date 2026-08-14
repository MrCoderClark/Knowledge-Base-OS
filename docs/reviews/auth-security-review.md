# Auth Security Review — `phase-1a-auth`

Self security review of the authentication/authorization system built per
[`docs/AUTHENTICATION.md`](../AUTHENTICATION.md) and
[`docs/specs/07-auth-security.md`](../specs/07-auth-security.md). Reviewer assumed an
attacker on the public internet who knows the architecture.

Date: 2026-08-14 · Branch: `phase-1a-auth` · Verdict: **ready to merge**, with the
documented residual risks and production checklist below.

---

## 1. Architecture summary

Credentials-only, admin-provisioned auth (no OAuth, no self-registration). Custom
server-side sessions (opaque token, HMAC-hashed at rest, httpOnly cookie). Argon2id
passwords. Redis rate limiting. Nodemailer email for invites/resets. Nonce-based CSP +
same-origin CSRF enforcement in `src/proxy.ts`. Postgres (Neon) via Drizzle.

Service layer (`src/server/auth/*`): `password`, `tokens`, `session`, `login`, `invite`,
`reset`, `change-password`, `policy`, `events`, plus `authz`, `ratelimit`, `email`, `env`.

---

## 2. Security controls implemented

| Threat | Control |
|---|---|
| Credential storage | Argon2id (`@node-rs/argon2`, m=19456,t=2,p=1); legacy bcrypt verified + transparently rehashed |
| Session theft | httpOnly + `__Host-`/Secure (prod) + SameSite=Lax; only HMAC hash stored |
| Session fixation | fresh session created every login; no pre-auth upgrade (test-covered) |
| Session lifetime | idle (8h) + absolute (1d/30d) + server-side revocation + active-session list |
| Brute force | Redis per-IP + per-account/IP limiters **and** Postgres soft-lock (5 fails/15m) |
| Enumeration | generic errors; constant-time dummy hash on unknown user; reset response timing equalized (fire-and-forget email) |
| Token abuse (invite/reset) | 32-byte random, HMAC-hashed, short TTL, **atomic one-time consume** (test-covered) |
| Reset misuse | all sessions revoked + lock/limits cleared; reject same-as-current; notification email |
| CSRF | SameSite=Lax + Origin check on all mutating requests + Next server-action origin checks |
| XSS | nonce-based CSP, `strict-dynamic` scripts, `frame-ancestors 'none'`, no tokens in localStorage |
| IDOR / broken access control | session revoke scoped to owner (test-covered); admin actions gated by `requireAdmin` |
| Privilege escalation | invite roles limited to admin/editor/viewer (cannot mint an owner) |
| Transport / headers | HSTS (prod), nosniff, Referrer-Policy, Permissions-Policy, XFO DENY |
| Secrets | Zod-validated env; token pepper (`TOKEN_HASHING_KEY`); nothing committed |
| Auditing | `security_events` for login/reset/lock/session/role events; never logs secrets |

---

## 3. Findings

**Fixed during review**
- **F1 — Reset response timing enumeration** *(fixed).* `/forgot-password` awaited the
  SMTP send only for real accounts, so response latency revealed existence. Email send is
  now fire-and-forget; both paths return on the same fast path.

**Residual (accepted / documented)**
- **R1 — Login failure timing (low).** A wrong password on a *real* account does an extra
  `UPDATE` (attempt counter) that an unknown email skips, a small timing difference.
  Rate limiting caps exploitation. Full constant-time would require equalized work on both
  paths; deferred.
- **R2 — Lockout message distinguishability (low).** A locked account surfaces "Too many
  attempts" vs "Invalid email or password". Because the IP rate-limiter uses the *same*
  message, it isn't a clean account-existence oracle, but it's a weak signal.
- **R3 — Session guard checks user status, not membership (low, forward-looking).** The
  `(app)` layout authorizes via `getCurrentSession` (user `status='active'`). When the
  Phase-1 **suspend** action lands it must set `user.status='suspended'` (or the guard must
  also check membership status) so suspension takes effect immediately. Tracked for the
  Users module.
- **R4 — `x-forwarded-for` trust (deployment).** Rate-limit/audit IPs read the first XFF
  entry; only trustworthy behind a proxy that overwrites XFF. See checklist.
- **R5 — Fire-and-forget email in serverless (ops).** F1's non-blocking send can be cut off
  if deployed to a platform that freezes the function after response. On a long-running
  server it's fine; for serverless, move email to a queue/waitUntil.

No auth-bypass, authz-bypass, token-reuse, fixation, or IDOR issues found (the last three
are regression-tested).

---

## 4. Dependencies added (auth track)

`@node-rs/argon2`, `ioredis`, `rate-limiter-flexible`, `nodemailer`, `zod`,
`@radix-ui/react-dropdown-menu`; dev: `drizzle-kit`, `vitest`, `@electric-sql/pglite`,
`@types/nodemailer`. Removed: `next-auth`, `@auth/drizzle-adapter`. `bcryptjs` retained
only for legacy-hash verification.

---

## 5. Environment variables

`DATABASE_URL`, `REDIS_URL`, `TOKEN_HASHING_KEY`, `APP_URL`, `SMTP_HOST/PORT/SECURE/USER/
PASSWORD`, `EMAIL_FROM`, `SEED_ADMIN_*`. All Zod-validated at startup (`src/server/env.ts`);
documented in `.env.example`. `AUTH_SECRET` is now unused (safe to delete).

---

## 6. Routes / actions

Pages: `/signin`, `/forgot-password`, `/reset-password/[token]`, `/invite/[token]`,
`/account/security`, `/users` (admin). Server actions: login, logout, invite,
accept-invite, forgot, reset, change-password, revoke-session, revoke-other-sessions.
No public API routes (proxy CSP/headers applied to all rendered routes).

---

## 7. Tests

24 passing — Vitest. Unit: Argon2id/bcrypt, policy, HMAC tokens. Integration (pglite
in-memory Postgres, real migrations): invite lifecycle, login, reset, change-password,
sessions. Security: enumeration, token reuse, fixation, soft-lock, IDOR, reset revocation.
E2e (Playwright) intentionally deferred.

---

## 8. Production deployment checklist

- [ ] Serve exclusively over **HTTPS** (enables `__Host-` cookie + HSTS).
- [ ] Provide `DATABASE_URL`, `REDIS_URL`, a strong unique `TOKEN_HASHING_KEY`, SMTP creds,
      and `APP_URL` via a **secrets manager**, not files.
- [ ] Run behind a proxy that **overwrites `X-Forwarded-For`** so rate-limit/audit IPs are
      trustworthy (R4).
- [ ] Managed **Redis** reachable from all instances (rate limits are distributed;
      in-memory insurance is per-instance only).
- [ ] Apply DB migrations on deploy; back up Postgres.
- [ ] **Rotate the credentials exposed during development**: Neon password, the Gmail app
      password, and change the seeded admin password.
- [ ] Verify security headers + CSP in production (no violations); confirm no `unsafe-eval`
      in prod CSP.
- [ ] Move transactional email to a deliverability-grade provider (or verified domain) and,
      if serverless, a background queue (R5).
- [ ] Set up monitoring on `security_events` (login-failure spikes, reset abuse, lockouts).

---

## 9. Recommended future improvements

- **MFA (TOTP + recovery codes)** — designed, not implemented; the single biggest residual.
- Reauthentication **time-window** gate for future sensitive ops (change email, delete
  account, disable MFA); `sessions.last_authenticated_at` is already maintained.
- Breached-password check (HIBP k-anonymity) layered into `policy.ts`.
- Admin-facing **lock status + unlock** in the Users module (already spec'd; clears DB +
  Redis).
- Constant-time login path (R1/R2) and queue-based email (R5) if moving to serverless.
- Playwright e2e for browser-level regression.
