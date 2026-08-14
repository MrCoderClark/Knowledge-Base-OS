/**
 * Password policy (length-first, per NIST). Breached-password checks (bundled
 * list / HIBP k-anon) can be layered in later behind this same function.
 */
const MIN = 12;
const MAX = 128;

// Small stop-list of obviously weak choices; expand with a bundled list later.
const COMMON = new Set([
  "password",
  "password1",
  "password123",
  "changeme",
  "changeme123",
  "qwertyuiop",
  "111111111111",
  "administrator",
]);

export function validatePassword(
  pw: string,
): { ok: true } | { ok: false; message: string } {
  if (pw.length < MIN)
    return { ok: false, message: `Password must be at least ${MIN} characters.` };
  if (pw.length > MAX)
    return { ok: false, message: `Password must be at most ${MAX} characters.` };
  if (COMMON.has(pw.toLowerCase()))
    return { ok: false, message: "That password is too common. Choose another." };
  return { ok: true };
}
