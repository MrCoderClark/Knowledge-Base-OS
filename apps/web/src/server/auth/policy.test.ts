import { describe, expect, it } from "vitest";
import { validatePassword } from "./policy";

describe("password policy", () => {
  it("rejects passwords shorter than 12 characters", () => {
    expect(validatePassword("short").ok).toBe(false);
    expect(validatePassword("elevenchars").ok).toBe(false); // 11
  });

  it("rejects passwords longer than 128 characters", () => {
    expect(validatePassword("a".repeat(129)).ok).toBe(false);
  });

  it("rejects common passwords even when long enough", () => {
    // "administrator" is 13 chars and on the stop-list.
    const res = validatePassword("administrator");
    expect(res.ok).toBe(false);
  });

  it("accepts a sufficiently long, uncommon password", () => {
    expect(validatePassword("a-perfectly-fine-passphrase").ok).toBe(true);
  });
});
