# Spec 07 — Authentication & Session Security (Design)

Status: **Design — awaiting sign-off** · Phase: 1a (auth track) · Owner: TBD

Authoritative design for the production-grade auth system requested in
[`docs/AUTHENTICATION.md`](../AUTHENTICATION.md). This **supersedes the
authentication portion** of [`03-auth-rbac.md`](./03-auth-rbac.md); that spec still
owns the **authorization / RBAC** model (roles, permission matrix, `requirePermission`),
which this design reuses unchanged.

> Process note: this is the Phase-2 *design*. No implementation until approved.
> Confirmed decisions (2026-08-13): custom server-side sessions (no Auth.js);
> admin-only invite provisioning (no self-registration, no OAuth); self-hosted Redis;
> email now (Resend, abstracted); MFA design-only (deferred implementation).

---

## 1. Architecture overview

Auth is split into small, independently testable services; HTTP handlers/actions are
thin and call services. No business logic in route handlers.

```
Browser ──cookie(__Host-kb_session: opaque token)──► Next.js (Node runtime)
                                                       │
   src/server/auth/                                    │
     ├─ password.ts   Argon2id hash/verify/needsRehash │
     ├─ session.ts    create / validate / rotate / revoke / list
     ├─ tokens.ts     invite + reset tokens (HMAC-hashed, one-time, atomic)
     ├─ login.ts      orchestration: ratelimit → verify → lockout → event → session
     ├─ invite.ts     admin creates user + sends invite
     ├─ reset.ts      forgot / reset password
     ├─ reauth.ts     "recent authentication" gate
     ├─ events.ts     security-event logger (no secrets)
     └─ state.ts      auth-state machine (MFA-ready)
   src/server/authz/  requireAuthenticatedUser / requireRole / requirePermission (spec 03)
   src/server/ratelimit/  rate-limiter-flexible limiters (Redis)
   src/server/email/  EmailService (Resend impl, swappable to SMTP)
   src/server/redis.ts  ioredis client (REDIS_URL)
   src/server/env.ts    Zod-validated env at startup
        │                    │                 │
        ▼                    ▼                 ▼
   Neon Postgres         self-hosted Redis   Resend (email)
   (users, sessions,     (rate limits,
    tokens, events)       ephemeral state)
```

**Removed from the Phase-0 starter:** `next-auth`, `@auth/*`, the
`/api/auth/[...nextauth]` route, JWT sessions, and bcrypt. See §13 (migration).

---

## 2. Authentication state machine (MFA-ready)

```
UNAUTHENTICATED
   └─ password verified ─► PASSWORD_AUTHENTICATED
                              ├─ (no MFA enrolled) ─────────► FULLY_AUTHENTICATED
                              └─ MFA enrolled ─► MFA_REQUIRED ─► FULLY_AUTHENTICATED
```

- A **full session cookie is issued only at `FULLY_AUTHENTICATED`.**
- `MFA_REQUIRED` is a **short-lived challenge** held in Redis (≤5 min), never a full
  session — so a password-only actor can never reach the app.
- MFA is **deferred**: today every user has no MFA, so `PASSWORD_AUTHENTICATED`
  transitions straight to `FULLY_AUTHENTICATED`. The challenge branch and `sessions`
  fields exist so enabling TOTP later needs no model change.

---

## 3. Data model (Drizzle / Postgres)

Reuses `organizations / memberships / teams / team_members` from spec 02/03. New and
changed tables below. All ids `uuid` unless noted; all times `timestamptz`.

### 3.1 `user` (changed)
| col | type | why |
|---|---|---|
| id | text pk | stable identity |
| email | text notnull | as entered (display) |
| normalized_email | text **unique** notnull | lowercased/trimmed; the lookup + uniqueness key (prevents dup accounts via casing) |
| name | text | profile |
| password_hash | text null | Argon2id; **null until invite accepted** |
| status | enum `user_status` | `invited \| active \| suspended` — gates login |
| email_verified_at | timestamptz null | set when invite/first-login completes |
| failed_login_attempts | int default 0 | throttling/lockout signal |
| locked_until | timestamptz null | temporary soft-lock window |
| last_login_at | timestamptz null | security UX + anomaly detection |
| created_at / updated_at | timestamptz | audit |

### 3.2 `sessions` (new — server-side)
| col | type | why |
|---|---|---|
| id | uuid pk | |
| user_id | text fk → user | owner |
| token_hash | text **unique** notnull | **HMAC-SHA256(token, TOKEN_HASHING_KEY)**; raw token only in the cookie, never stored |
| created_at | timestamptz | absolute-lifetime anchor |
| expires_at | timestamptz | absolute expiry |
| last_seen_at | timestamptz | idle-timeout anchor (throttled write) |
| last_authenticated_at | timestamptz | drives §8 reauthentication |
| revoked_at | timestamptz null | server-side revocation |
| ip | text null | truncated/last-octet-masked (privacy) |
| user_agent | text null | device list |
Index: `token_hash`, `user_id`.

### 3.3 `credential_tokens` (new — invite + password reset)
One table, `purpose` discriminator; atomic one-time consumption.
| col | type | why |
|---|---|---|
| id | uuid pk | |
| user_id | text fk → user | target |
| purpose | enum | `invite \| password_reset` |
| token_hash | text **unique** | HMAC-SHA256 of the raw token (never store raw) |
| expires_at | timestamptz | short (invite 72h, reset 30m — configurable) |
| consumed_at | timestamptz null | one-time; consumed via atomic `UPDATE … WHERE consumed_at IS NULL RETURNING` |
| created_by | text fk → user null | admin who issued an invite |
| created_at | timestamptz | |

### 3.4 `security_events` (new — audit)
| col | type | why |
|---|---|---|
| id | uuid pk | |
| type | enum `security_event` | see §9 |
| user_id | text null | may be unknown (failed login on unknown email) |
| org_id | uuid null | tenant context |
| ip | text null | masked |
| user_agent | text null | |
| metadata | jsonb null | **never** secrets/tokens |
| created_at | timestamptz | index(created_at), index(user_id) |

### 3.5 MFA (design-only — created in the MFA phase, not now)
- `mfa_credentials(user_id, type='totp', secret_encrypted, confirmed_at)` — secret
  encrypted at rest with AES-256-GCM using `MFA_ENCRYPTION_KEY`.
- `mfa_recovery_codes(user_id, code_hash, used_at)` — Argon2id-hashed, one-time.

### 3.6 OAuth (design-only — not created)
Extension point: an `oauth_accounts(user_id, provider, provider_account_id, …)` table
with a **manual, verified linking** flow (never auto-link on matching email). Documented
for the future; no provider implemented.

---

## 4. Password security

- **Algorithm:** Argon2id via **`@node-rs/argon2`** (prebuilt binaries → reliable on
  Windows + serverless; no native toolchain). Params (OWASP-aligned, tunable in one
  place): `memoryCost=19456 KiB, timeCost=2, parallelism=1, outputLen=32`.
- **Abstraction:** `PasswordHasher { hash(pw), verify(hash, pw), needsRehash(hash) }`
  so the algorithm/params can change without touching auth logic. Transparent rehash on
  successful login when `needsRehash` is true (also the bcrypt→argon2id migration path).
- **Policy:** length-first per NIST — **min 12 chars**, max 128, reject
  top-breached/common passwords (bundled list check; optional HIBP k-anon later). No
  arbitrary "1 upper + 1 symbol" rule.
- **Never** logged, returned, or exposed via any API. `verify` is constant-time (library
  guarantee). Password change/reset **revokes all other sessions** and emits an event +
  notification email.

---

## 5. Session management

- **Token:** 32 bytes from `crypto.randomBytes`, base64url. Cookie holds the raw token;
  DB holds only `HMAC-SHA256(token, TOKEN_HASHING_KEY)` → DB compromise alone can't forge
  or reuse sessions.
- **Cookie:** `__Host-kb_session` (prod: `Secure`, `Path=/`, no `Domain`), `HttpOnly`,
  `SameSite=Lax`. Dev uses a non-`__Host-` name over http.
- **Lifetimes:** idle timeout (default **8h** via `last_seen_at`) **and** absolute
  lifetime (default **30d** via `expires_at`). "Remember me" chooses absolute 30d vs a
  short 1-day/session cookie. `last_seen_at` written at most once/minute (avoid write
  amplification).
- **Fixation:** login always **creates a new** session row/token; no pre-auth session is
  ever upgraded.
- **Rotation:** token rotated on password change and before privileged elevation.
- **Revocation:** `revoked_at`; `revoke(sessionId)` and `revokeAll(userId)`. Validation
  rejects revoked/expired/idle-expired sessions and checks the user is still `active`
  with a valid membership → suspending a user kills access on the next request.
- **Active sessions UI:** list from `sessions` (device/UA, ip masked, last seen, current
  flag); revoke one / revoke others.
- **Where validated:** `getCurrentSession()` server util used by RSC, route handlers, and
  server actions (Node runtime; touches Postgres). Edge middleware only does a cheap
  cookie-presence redirect for protected paths + sets security headers — **authoritative
  checks are server-side**, never in middleware alone.

---

## 6. Login flow

1. Zod-validate input; normalize email.
2. **Rate-limit** (see §7) by IP **and** by normalized-email before any DB/hash work.
3. Look up user by `normalized_email`. **Always run an Argon2id verify** — against a
   dummy hash when the user is missing — so response timing can't reveal account
   existence (anti-enumeration).
4. If `locked_until` in the future or `status != active` → generic failure.
5. On success: reset `failed_login_attempts`, set `last_login_at`, create a fresh
   session, emit `LOGIN_SUCCESS`. On failure: increment attempts, apply progressive
   backoff, soft-lock temporarily past a threshold, emit `LOGIN_FAILURE`.
6. **Generic error** to the client in all failure cases ("Invalid email or password").

**Lockout tradeoff (documented):** a hard per-account lock is a DoS vector (attacker
locks a victim). We use **temporary** soft-locks + progressive backoff + IP limits, and
keep a CAPTCHA/step-up hook, rather than indefinite lockout. See §14 threat model.

---

## 7. Rate limiting (self-hosted Redis)

- **Library:** `rate-limiter-flexible` on **`ioredis`** (`REDIS_URL`), with an in-memory
  insurance limiter as a fallback if Redis is briefly unavailable (fail-closed on
  security-critical paths).
- **Keys:** layered — **per-IP** and **per-account** (and per-token where relevant) so
  neither single-account brute force nor distributed spraying (many accounts/one IP, or
  one account/many IPs) trivially bypasses. IP alone is never the only dimension.
- **Protected ops:** login, invite-accept/set-password, forgot-password request,
  reset-password consume, resend-invite, reauth, and (future) MFA verify/enroll.
- **Persistent lock authority** lives in Postgres (`locked_until`) so it survives a Redis
  flush; Redis provides fast, distributed counters. Limits are cheap O(1) ops (no DoS via
  the limiter itself).
- **Admin unlock:** the ratelimit module exposes a `clearLoginLimitsForAccount(email)`
  helper (deletes the `rl_login_acct:*` keys); the Users-module unlock action calls it
  **and** clears `locked_until`/`failed_login_attempts` in Postgres so the user can sign
  in immediately (see the Users module in [`05-features.md`](./05-features.md)).

---

## 8. Reauthentication ("recent auth")

- "Recent" = `now - session.last_authenticated_at ≤ REAUTH_WINDOW` (default **10 min**).
- `requireRecentAuth()` gate on: change password, change email, revoke sessions, disable
  MFA (future), org ownership/admin changes, generate API credentials (future).
- Successful reauth updates `last_authenticated_at` and rotates the session token.

---

## 9. Security events & observability

Structured events via `events.ts` → `security_events` + structured app log (event type,
timestamp, user id if known, correlation/request id, masked ip, UA, result, failure
category). **Never** logs passwords, tokens, secrets, or recovery codes.

Enum: `LOGIN_SUCCESS, LOGIN_FAILURE, LOGOUT, ACCOUNT_INVITED, INVITE_ACCEPTED,
PASSWORD_CHANGED, PASSWORD_RESET_REQUESTED, PASSWORD_RESET_COMPLETED, ACCOUNT_LOCKED,
ACCOUNT_UNLOCKED, SESSION_CREATED, SESSION_REVOKED, ALL_SESSIONS_REVOKED, ROLE_CHANGED,
USER_SUSPENDED, SUSPICIOUS_LOGIN` (+ future `MFA_ENABLED/DISABLED/FAILURE`,
`OAUTH_ACCOUNT_LINKED/UNLINKED`). Enables detection of credential stuffing, reset abuse,
and enumeration attempts.

---

## 10. CSRF, headers, and transport

**CSRF threat model (not just "SameSite"):** sessions are cookie-based, so state-changing
requests need protection. Layers:
1. `SameSite=Lax` blocks cookies on cross-site POST/PUT/PATCH/DELETE.
2. **Origin/Referer check** on every mutating route handler + server action against the
   allowed app origin (`APP_URL`) — defends the residual Lax GET/top-level cases.
3. All state changes are non-GET; GETs are side-effect-free.
4. Next Server Actions' built-in same-origin checks are kept, not relied on alone.

**Security headers** (middleware/`next.config`): `Strict-Transport-Security` (prod),
`X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`,
`Permissions-Policy` (deny camera/mic/geo), `X-Frame-Options: DENY` +
`frame-ancestors 'none'`, and a **CSP built from the actual app** (self scripts/styles,
`img-src 'self' data:`, `connect-src 'self'`, no external CDNs/fonts since Inter is
self-hosted via `next/font`). Any unavoidable `unsafe-inline` for styles is documented;
scripts use nonces where feasible.

---

## 11. Frontend surfaces

- `/signin` — email+password (reworked to the new session flow); generic errors.
- `/invite/[token]` — set initial password (validates token, enforces policy).
- `/forgot-password` — request reset; **always** generic success.
- `/reset-password/[token]` — set new password; revokes other sessions.
- `/account/security` — change password, active sessions list + revoke, (future) MFA.
- MFA enroll/challenge/recovery pages — **deferred** (routes reserved).
No registration page exists anywhere.

---

## 12. Service/API boundaries & code quality

Separate modules per §1; strongly typed, no `any`, Zod at every boundary, no giant
handlers, single authorization layer (spec 03), security-critical code clearly labeled.
Server-only secrets never reach the client; only `NEXT_PUBLIC_*` is client-exposed.

---

## 13. Migration from the Phase-0 starter

- **Remove** `next-auth`, `@auth/drizzle-adapter`, `/api/auth/[...nextauth]`, JWT config,
  and the session-type augmentation. Replace `(app)/layout.tsx` guard with
  `getCurrentSession()`.
- **bcrypt → Argon2id:** `PasswordHasher` supports legacy verify + `needsRehash` for
  transparent upgrade. In practice only the **seed admin** exists, so we re-seed it with
  an Argon2id hash; the transparent path remains for safety.
- **Schema:** one Drizzle migration adds `sessions`, `credential_tokens`,
  `security_events`, the `user` column/enum changes, and (deferred) MFA tables when that
  phase starts. Existing `organizations/memberships/teams` untouched.
- **No real users exist**, so no forced-reset campaign is needed now; the design supports
  one if that changes.

---

## 14. Threat model (attack → surface → mitigation → residual)

| Attack | Surface | Mitigation | Residual |
|---|---|---|---|
| Credential stuffing | /signin | IP+account rate limit, breached-pw block, events→detection | Low-rate distributed attempts; needs monitoring/CAPTCHA hook |
| Brute force | /signin | Backoff + temp soft-lock + Argon2id cost | Online guessing slowed, not zero |
| Account enumeration | login/forgot/invite | Generic responses; dummy-hash constant-time | Very low |
| Session theft (XSS) | cookie | `HttpOnly`, strict CSP, no localStorage tokens | Depends on app XSS hygiene |
| Session fixation | login | Always new session; no pre-auth upgrade | Mitigated |
| Session replay/stolen token | cookie | Hashed-at-rest token, idle+absolute expiry, revocation, device list | Window until revoke/expiry |
| CSRF | mutating routes/actions | SameSite=Lax + Origin check + non-GET writes | Mitigated |
| Password-reset abuse | /forgot,/reset | Rate limit, generic response, HMAC-hashed one-time short-lived token, atomic consume | Low |
| Privilege escalation / broken access control | actions/APIs | Server-side `requirePermission`, single authz layer | Depends on coverage → tests |
| IDOR / cross-tenant | tenant queries | Mandatory `org_id` scoping + `requireOrgAccess` | Depends on coverage → tests |
| Token double-use race | reset/invite | Atomic `UPDATE … WHERE consumed_at IS NULL RETURNING` | Mitigated |
| Insider/admin abuse | admin ops | Reauth gate + audit events | Trust-bounded; logged |
| MFA bypass | (future) | Session only at FULLY_AUTHENTICATED; challenge in Redis | N/A until MFA ships |

---

## 15. Dependencies (with justification)

| Package | Why | Notes |
|---|---|---|
| `@node-rs/argon2` | Argon2id hashing | Prebuilt binaries; Windows/serverless-safe |
| `zod` | Validation at all boundaries | Also validates env |
| `ioredis` | Redis client (self-hosted) | Mature, connection-pool friendly |
| `rate-limiter-flexible` | Distributed rate limiting | Redis-backed, block/backoff support |
| `resend` | Transactional email | Behind `EmailService`; swappable to SMTP/nodemailer |
| `otpauth` *(MFA phase)* | TOTP | Not added now |
| (built-in) `crypto` | Tokens, HMAC, AES-GCM | No custom crypto |

Removed: `next-auth`, `@auth/drizzle-adapter`, `bcryptjs`, `@types/bcryptjs`.

---

## 16. Environment variables (Zod-validated at startup)

| Var | Scope | Purpose |
|---|---|---|
| `DATABASE_URL` | server | Neon Postgres |
| `REDIS_URL` | server | self-hosted Redis |
| `TOKEN_HASHING_KEY` | server | HMAC key for session/token hashing (pepper) |
| `RESEND_API_KEY` | server | email |
| `EMAIL_FROM` | server | sender identity |
| `APP_URL` | server | email links + Origin/CSRF checks |
| `MFA_ENCRYPTION_KEY` | server | *(MFA phase)* AES-GCM key |
| `SEED_ADMIN_*` | server | seed owner admin |
Startup fails fast if any required var is missing/invalid. No secrets committed;
`.env.example` documents all.

---

## 17. Proposed implementation sequence (Phase 3 — incremental commits)

Each step: typecheck + lint + tests before the next. On branch `phase-1a-auth`.

1. **Foundations:** env validation, redis client, `security_events`, Argon2id hasher,
   schema migration; rip out Auth.js; re-seed admin. *(commit)*
2. **Sessions:** `session.ts` + cookie plumbing + `getCurrentSession()` + `(app)` guard +
   logout. *(commit)*
3. **Login + rate limiting + lockout** + events. *(commit)*
4. **Admin invite + set-password** (email via Resend). *(commit)*
5. **Forgot/reset password** + session revocation + notifications. *(commit)*
6. **Reauthentication** + `/account/security` (change password, active sessions). *(commit)*
7. **CSRF/Origin checks + security headers + CSP.** *(commit)*
8. **Tests:** unit + integration + security + e2e (Vitest + Playwright). *(commit)*
9. **Self security review (Phase 4)** + final verification (Phase 5). *(commit)*

MFA (TOTP + recovery codes) and OAuth remain designed-but-deferred.

---

## 18. Known limitations / future work

- No MFA yet (biggest residual — single factor). Design is ready.
- No breached-password *online* check (bundled list only) until HIBP k-anon added.
- Anomaly detection is event-emission + hooks, not an ML/behavioral system.
- Enterprise SSO/SAML/SCIM is a future additional provider (spec 03 Phase 3).
