import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // Dummy but schema-valid env so modules that import env.ts load in tests
    // (no service actually connects during unit tests).
    env: {
      DATABASE_URL: "postgresql://user:pass@localhost:5432/db",
      REDIS_URL: "redis://127.0.0.1:6379",
      TOKEN_HASHING_KEY: "test-token-hashing-key-at-least-32-characters",
      APP_URL: "http://localhost:3000",
      SMTP_HOST: "smtp.example.com",
      SMTP_PORT: "587",
      SMTP_SECURE: "false",
      SMTP_USER: "user",
      SMTP_PASSWORD: "pass",
      EMAIL_FROM: "KnowledgeOS <no-reply@example.com>",
      S3_ENDPOINT: "http://localhost:9000",
      S3_ACCESS_KEY: "test-access-key",
      S3_SECRET_KEY: "test-secret-key",
      S3_BUCKET: "test-bucket",
      AI_SERVICE_URL: "http://localhost:8001",
      AI_SERVICE_TOKEN: "test-ai-token",
      NODE_ENV: "test",
    },
  },
});
