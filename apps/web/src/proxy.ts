import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Edge proxy (Next 16's renamed middleware). Sets a nonce-based CSP + security
 * headers on every rendered response, and rejects cross-origin state-changing
 * requests as defense-in-depth CSRF protection (on top of SameSite=Lax cookies
 * and Next's built-in server-action origin checks).
 */

const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export function proxy(request: NextRequest): NextResponse {
  const isDev = process.env.NODE_ENV === "development";

  // --- CSRF: same-origin enforcement for state-changing requests ---
  if (MUTATING.has(request.method)) {
    const origin = request.headers.get("origin");
    if (origin) {
      const host = request.headers.get("host");
      if (new URL(origin).host !== host) {
        return new NextResponse("Invalid origin", { status: 403 });
      }
    }
  }

  // --- Content Security Policy (nonce + strict-dynamic for scripts) ---
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = [
    `default-src 'self'`,
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    // React sets inline style attributes (e.g. progress bars); nonces don't
    // cover style attributes, so 'unsafe-inline' for styles is an accepted,
    // documented exception. Scripts remain strictly nonce-gated.
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' blob: data:`,
    `font-src 'self'`,
    `object-src 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `frame-ancestors 'none'`,
    `connect-src 'self'${isDev ? " ws: wss:" : ""}`,
    `upgrade-insecure-requests`,
  ].join("; ");

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });

  // --- Security headers ---
  response.headers.set("Content-Security-Policy", csp);
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), browsing-topics=()",
  );
  if (!isDev) {
    response.headers.set(
      "Strict-Transport-Security",
      "max-age=63072000; includeSubDomains; preload",
    );
  }

  return response;
}

export const config = {
  matcher: [
    {
      source: "/((?!api|_next/static|_next/image|favicon.ico).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
