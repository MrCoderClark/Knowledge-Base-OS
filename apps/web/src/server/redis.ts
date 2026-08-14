import Redis from "ioredis";
import { env } from "./env";

/**
 * Shared ioredis client (self-hosted Redis). Reused across hot reloads in dev
 * to avoid exhausting connections. Used for rate limiting and ephemeral
 * security state (e.g. MFA challenges later).
 */
const globalForRedis = globalThis as unknown as { redis?: Redis };

export const redis =
  globalForRedis.redis ??
  new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: 3,
    lazyConnect: false,
  });

if (env.NODE_ENV !== "production") globalForRedis.redis = redis;
