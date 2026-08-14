import { and, eq } from "drizzle-orm";
import { hashPassword } from "../auth/password";
import { db } from "./index";
import { memberships, organizations, users } from "./schema";

/**
 * Idempotent seed — one org + one owner admin with a login password, so the
 * app is usable immediately. Override via env:
 *   SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD, SEED_ADMIN_NAME
 * Run with:  bun run db:seed
 */
async function main() {
  const adminEmail = (process.env.SEED_ADMIN_EMAIL ?? "admin@acme.test")
    .trim()
    .toLowerCase();
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? "ChangeMe!123";
  const adminName = process.env.SEED_ADMIN_NAME ?? "John Admin";

  const slug = "acme";
  let [org] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.slug, slug));
  if (!org) {
    [org] = await db
      .insert(organizations)
      .values({ name: "Acme Knowledge Core", slug })
      .returning();
    console.log("✓ org created:", org.id);
  } else {
    console.log("• org exists:", org.id);
  }

  const passwordHash = await hashPassword(adminPassword);
  let [admin] = await db.select().from(users).where(eq(users.email, adminEmail));
  if (!admin) {
    [admin] = await db
      .insert(users)
      .values({
        name: adminName,
        email: adminEmail,
        normalizedEmail: adminEmail,
        passwordHash,
        status: "active",
        emailVerifiedAt: new Date(),
      })
      .returning();
    console.log("✓ admin user created:", admin.email);
  } else {
    // Backfill fields introduced by the auth migration; upgrade password if unset.
    await db
      .update(users)
      .set({
        normalizedEmail: admin.normalizedEmail ?? adminEmail,
        status: "active",
        passwordHash: admin.passwordHash ?? passwordHash,
        // Reset lock state so re-seeding also unlocks the admin during dev.
        failedLoginAttempts: 0,
        lockedUntil: null,
      })
      .where(eq(users.id, admin.id));
    console.log("• admin user updated (lock reset):", admin.email);
  }

  const existing = await db
    .select()
    .from(memberships)
    .where(and(eq(memberships.orgId, org.id), eq(memberships.userId, admin.id)));
  if (existing.length === 0) {
    await db.insert(memberships).values({
      orgId: org.id,
      userId: admin.id,
      role: "owner",
      status: "active",
    });
    console.log("✓ owner membership created");
  } else {
    console.log("• owner membership exists");
  }

  console.log(`\nSeed complete. Sign in at /signin with:`);
  console.log(`  email:    ${adminEmail}`);
  console.log(
    `  password: ${process.env.SEED_ADMIN_PASSWORD ? "(from SEED_ADMIN_PASSWORD)" : adminPassword}`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
