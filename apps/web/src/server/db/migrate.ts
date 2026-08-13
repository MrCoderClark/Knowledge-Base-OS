import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { migrate } from "drizzle-orm/neon-http/migrator";

/**
 * Applies generated migrations to Neon over HTTP (fetch-based) — avoids the
 * TCP SSL / channel-binding friction of connecting drizzle-kit directly.
 * Run with:  bun run src/server/db/migrate.ts   (via: bun run db:migrate)
 */
async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set");
  const sql = neon(process.env.DATABASE_URL);
  const db = drizzle(sql);
  await migrate(db, { migrationsFolder: "./src/server/db/migrations" });
  console.log("Migrations applied.");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
