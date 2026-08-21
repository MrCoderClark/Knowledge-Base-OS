import { z } from "zod";

/**
 * Server-only environment validation. Import this from server code to get
 * typed, validated config. Fails fast at startup if anything required is
 * missing or malformed. Never import from client components.
 */
const schema = z.object({
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  TOKEN_HASHING_KEY: z.string().min(32, "TOKEN_HASHING_KEY must be >= 32 chars"),
  APP_URL: z.string().url(),

  SMTP_HOST: z.string().min(1),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_SECURE: z
    .string()
    .transform((v) => v === "true")
    .default(false),
  SMTP_USER: z.string().min(1),
  SMTP_PASSWORD: z.string().min(1),
  EMAIL_FROM: z.string().min(1),

  // Object storage (MinIO / S3-compatible).
  S3_ENDPOINT: z.string().url(),
  S3_ACCESS_KEY: z.string().min(1),
  S3_SECRET_KEY: z.string().min(1),
  S3_BUCKET: z.string().min(1),
  S3_REGION: z.string().default("us-east-1"),

  // Media/AI processing service (apps/ai).
  AI_SERVICE_URL: z.string().url(),
  AI_SERVICE_TOKEN: z.string().min(1),

  // LLM helpers (optional — features degrade gracefully if unset).
  AI_PROVIDER: z.enum(["openrouter", "gemini"]).optional(),
  OPENROUTER_API_KEY: z.string().optional(),
  // OpenRouter's free catalog rotates; set OPENROUTER_MODEL to a current ":free"
  // slug from https://openrouter.ai/models?max_price=0
  OPENROUTER_MODEL: z.string().default("nvidia/nemotron-3.5-lightning:free"),
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().default("gemini-2.0-flash"),

  // Shared secret to authorize the due-reminder cron endpoint (optional).
  CRON_SECRET: z.string().optional(),

  SEED_ADMIN_EMAIL: z.string().email().optional(),
  SEED_ADMIN_PASSWORD: z.string().optional(),
  SEED_ADMIN_NAME: z.string().optional(),

  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
    .join("\n");
  throw new Error(`Invalid environment variables:\n${issues}`);
}

export const env = parsed.data;
export const isProd = env.NODE_ENV === "production";
