import { PGlite } from "@electric-sql/pglite";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import * as schema from "@/server/db/schema";

/**
 * In-memory Postgres (pglite) for integration tests — real SQL, no external
 * database. The project's actual Drizzle migrations are applied once on import.
 */
const client = new PGlite();
export const db = drizzle(client, { schema });
export { schema };

await migrate(db, { migrationsFolder: "./src/server/db/migrations" });

/** Truncate all tables between tests for isolation. */
export async function resetTestDb(): Promise<void> {
  await db.execute(
    sql`TRUNCATE "user", organizations, memberships, teams, team_members, sessions, credential_tokens, security_events RESTART IDENTITY CASCADE;`,
  );
}
