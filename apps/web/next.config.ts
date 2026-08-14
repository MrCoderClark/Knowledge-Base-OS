import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Native / server-only packages must not be bundled by Turbopack; load them
  // via Node's require at runtime instead.
  serverExternalPackages: [
    "@node-rs/argon2",
    "ioredis",
    "bcryptjs",
    "rate-limiter-flexible",
  ],
};

export default nextConfig;
