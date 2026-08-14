import bcrypt from "bcryptjs";
import { describe, expect, it } from "vitest";
import { hashPassword, needsRehash, verifyPassword } from "./password";

describe("password hashing", () => {
  it("hashes with Argon2id and verifies correct/incorrect passwords", async () => {
    const hash = await hashPassword("correct horse battery staple");
    expect(hash.startsWith("$argon2id$")).toBe(true);
    expect(await verifyPassword(hash, "correct horse battery staple")).toBe(true);
    expect(await verifyPassword(hash, "wrong password entirely")).toBe(false);
  });

  it("produces distinct hashes for the same input (salted)", async () => {
    const a = await hashPassword("repeatedPassword123");
    const b = await hashPassword("repeatedPassword123");
    expect(a).not.toEqual(b);
  });

  it("verifies legacy bcrypt hashes (migration path)", async () => {
    const legacy = await bcrypt.hash("legacyPassword123", 10);
    expect(await verifyPassword(legacy, "legacyPassword123")).toBe(true);
    expect(await verifyPassword(legacy, "nope")).toBe(false);
  });

  it("flags legacy bcrypt for rehash but not Argon2id", async () => {
    const legacy = await bcrypt.hash("x", 10);
    expect(needsRehash(legacy)).toBe(true);
    const modern = await hashPassword("x-modern-password");
    expect(needsRehash(modern)).toBe(false);
  });

  it("returns false (never throws) on a malformed hash", async () => {
    expect(await verifyPassword("not-a-real-hash", "whatever")).toBe(false);
  });
});
