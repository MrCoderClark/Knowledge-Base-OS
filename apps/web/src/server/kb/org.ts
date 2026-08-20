import { and, eq, ne } from "drizzle-orm";
import { db } from "@/server/db";
import { organizations } from "@/server/db/schema";

export type Org = { id: string; name: string; slug: string };

export async function getOrg(orgId: string): Promise<Org | null> {
  const [row] = await db
    .select({
      id: organizations.id,
      name: organizations.name,
      slug: organizations.slug,
    })
    .from(organizations)
    .where(eq(organizations.id, orgId));
  return row ?? null;
}

/** Whether another org already uses this slug (uniqueness guard). */
export async function slugTaken(
  slug: string,
  exceptOrgId: string,
): Promise<boolean> {
  const [row] = await db
    .select({ id: organizations.id })
    .from(organizations)
    .where(
      and(eq(organizations.slug, slug), ne(organizations.id, exceptOrgId)),
    );
  return !!row;
}

export async function updateOrg(
  orgId: string,
  name: string,
  slug: string,
): Promise<void> {
  await db
    .update(organizations)
    .set({ name, slug, updatedAt: new Date() })
    .where(eq(organizations.id, orgId));
}
