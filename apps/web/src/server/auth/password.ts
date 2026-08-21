import { hash, verify } from "@node-rs/argon2";

/**
 * Password hashing abstraction. Argon2id is the current algorithm; the shape
 * of this module lets us change parameters/algorithms without touching auth
 * logic. Legacy bcrypt hashes are still verifiable so existing accounts can be
 * transparently upgraded on next login (see `needsRehash`).
 */

// OWASP-aligned Argon2id parameters (tunable in one place).
// @node-rs/argon2 exports Algorithm as an ambient const enum, which
// `isolatedModules` forbids referencing; use its literal value (Argon2id = 2).
const ARGON2_OPTS = {
  algorithm: 2, // Algorithm.Argon2id
  memoryCost: 19456, // KiB (~19 MiB)
  timeCost: 2,
  parallelism: 1,
  // outputLen defaults to 32
} as const;

export function hashPassword(plain: string): Promise<string> {
  return hash(plain, ARGON2_OPTS);
}

export async function verifyPassword(
  storedHash: string,
  plain: string,
): Promise<boolean> {
  if (isBcryptHash(storedHash)) {
    // Lazy-load bcrypt only for legacy verification.
    const bcrypt = (await import("bcryptjs")).default;
    return bcrypt.compare(plain, storedHash);
  }
  try {
    return await verify(storedHash, plain);
  } catch {
    return false;
  }
}

/** True when the stored hash should be re-hashed with the current algorithm. */
export function needsRehash(storedHash: string): boolean {
  // Any non-Argon2id hash (e.g. legacy bcrypt) should be upgraded.
  return !storedHash.startsWith("$argon2id$");
}

function isBcryptHash(h: string): boolean {
  return h.startsWith("$2a$") || h.startsWith("$2b$") || h.startsWith("$2y$");
}
