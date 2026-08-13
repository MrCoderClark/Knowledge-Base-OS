import crypto from "node:crypto";
import { env } from "@/server/env";

/**
 * Secure token primitives. Raw tokens are handed to the client (cookie / email
 * link); only their HMAC hash is ever stored, so a DB leak can't reuse them.
 */

/** Cryptographically-random URL-safe token (default 32 bytes). */
export function generateToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString("base64url");
}

/** Keyed hash (HMAC-SHA256) of a token for at-rest storage/lookup. */
export function hashToken(token: string): string {
  return crypto
    .createHmac("sha256", env.TOKEN_HASHING_KEY)
    .update(token)
    .digest("hex");
}
