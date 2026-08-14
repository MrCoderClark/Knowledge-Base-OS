import { describe, expect, it } from "vitest";
import { generateToken, hashToken } from "./tokens";

describe("tokens", () => {
  it("generates unique, URL-safe tokens", () => {
    const a = generateToken();
    const b = generateToken();
    expect(a).not.toEqual(b);
    expect(a).toMatch(/^[A-Za-z0-9_-]+$/); // base64url
    expect(a.length).toBeGreaterThan(20);
  });

  it("hashes deterministically and never returns the raw token", () => {
    const token = generateToken();
    expect(hashToken(token)).toEqual(hashToken(token));
    expect(hashToken(token)).not.toEqual(token);
    expect(hashToken(token)).toMatch(/^[0-9a-f]{64}$/); // HMAC-SHA256 hex
  });

  it("maps different tokens to different hashes", () => {
    expect(hashToken("alpha")).not.toEqual(hashToken("beta"));
  });
});
