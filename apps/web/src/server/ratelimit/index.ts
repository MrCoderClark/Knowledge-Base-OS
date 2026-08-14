import { RateLimiterMemory, RateLimiterRedis } from "rate-limiter-flexible";
import { redis } from "@/server/redis";

/**
 * Distributed rate limiting for security-sensitive endpoints (self-hosted
 * Redis). Layered so neither single-account brute force nor password spraying
 * (many accounts / one IP) slips through:
 *   - per-IP:            broad cap across all accounts from one source
 *   - per-account+IP:    tight cap on repeated failures for one account
 *
 * If Redis is briefly unavailable, an in-memory insurance limiter degrades to
 * per-instance limiting rather than failing the request path outright.
 * The authoritative *persistent* account lock still lives in Postgres
 * (`user.locked_until`, enforced in login.ts).
 */

const loginByIp = new RateLimiterRedis({
  storeClient: redis,
  keyPrefix: "rl_login_ip",
  points: 60, // attempts
  duration: 60 * 60, // per hour
  blockDuration: 60 * 60, // then block 1h
  insuranceLimiter: new RateLimiterMemory({
    points: 60,
    duration: 60 * 60,
    blockDuration: 60 * 60,
  }),
});

const loginByAccountIp = new RateLimiterRedis({
  storeClient: redis,
  keyPrefix: "rl_login_acct",
  points: 5, // consecutive failures
  duration: 15 * 60, // per 15 min
  blockDuration: 15 * 60, // then block 15 min
  insuranceLimiter: new RateLimiterMemory({
    points: 5,
    duration: 15 * 60,
    blockDuration: 15 * 60,
  }),
});

type Ctx = { ip: string | null; email: string };

function keys({ ip, email }: Ctx) {
  const ipKey = ip ?? "unknown";
  return { ipKey, acctKey: `${ipKey}:${email}` };
}

export type RateLimitCheck =
  | { ok: true }
  | { ok: false; retryAfterSec: number };

/** Non-consuming pre-check: is this IP or account currently blocked? */
export async function checkLoginRateLimit(ctx: Ctx): Promise<RateLimitCheck> {
  const { ipKey, acctKey } = keys(ctx);
  const [ipRes, acctRes] = await Promise.all([
    loginByIp.get(ipKey),
    loginByAccountIp.get(acctKey),
  ]);

  const blocked =
    (ipRes !== null && ipRes.remainingPoints <= 0) ||
    (acctRes !== null && acctRes.remainingPoints <= 0);

  if (blocked) {
    const ms = Math.max(ipRes?.msBeforeNext ?? 0, acctRes?.msBeforeNext ?? 0);
    return { ok: false, retryAfterSec: Math.max(1, Math.ceil(ms / 1000)) };
  }
  return { ok: true };
}

/** Count a failed attempt against both limiters. */
export async function registerLoginFailure(ctx: Ctx): Promise<void> {
  const { ipKey, acctKey } = keys(ctx);
  await Promise.all([
    loginByIp.consume(ipKey).catch(() => undefined),
    loginByAccountIp.consume(acctKey).catch(() => undefined),
  ]);
}

/** Clear the per-account failure counter after a successful login. */
export async function registerLoginSuccess(ctx: Ctx): Promise<void> {
  const { acctKey } = keys(ctx);
  await loginByAccountIp.delete(acctKey).catch(() => undefined);
}
