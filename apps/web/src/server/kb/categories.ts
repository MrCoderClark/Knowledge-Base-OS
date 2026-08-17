import { and, asc, eq } from "drizzle-orm";
import { db } from "@/server/db";
import { categories } from "@/server/db/schema";

export type Category = typeof categories.$inferSelect;

export function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 64) || "category"
  );
}

export function listCategories(orgId: string): Promise<Category[]> {
  return db
    .select()
    .from(categories)
    .where(eq(categories.orgId, orgId))
    .orderBy(asc(categories.name));
}

async function uniqueSlug(orgId: string, name: string): Promise<string> {
  const base = slugify(name);
  let slug = base;
  let n = 1;
  // Loop until an unused slug is found for this org.
  for (;;) {
    const [existing] = await db
      .select({ id: categories.id })
      .from(categories)
      .where(and(eq(categories.orgId, orgId), eq(categories.slug, slug)));
    if (!existing) return slug;
    slug = `${base}-${++n}`;
  }
}

export async function createCategory(params: {
  orgId: string;
  name: string;
  color?: string | null;
}): Promise<Category> {
  const slug = await uniqueSlug(params.orgId, params.name);
  const [row] = await db
    .insert(categories)
    .values({
      orgId: params.orgId,
      name: params.name.trim(),
      slug,
      color: params.color ?? null,
    })
    .returning();
  return row;
}

export async function updateCategory(params: {
  orgId: string;
  id: string;
  name: string;
  color?: string | null;
}): Promise<void> {
  await db
    .update(categories)
    .set({ name: params.name.trim(), color: params.color ?? null })
    .where(and(eq(categories.id, params.id), eq(categories.orgId, params.orgId)));
}

export async function deleteCategory(params: {
  orgId: string;
  id: string;
}): Promise<void> {
  await db
    .delete(categories)
    .where(and(eq(categories.id, params.id), eq(categories.orgId, params.orgId)));
}
