import { and, desc, eq } from "drizzle-orm";
import { db } from "@/server/db";
import { categories, documentVersions, documents } from "@/server/db/schema";
import { slugify } from "./categories";

export type DocStatus = "draft" | "published" | "archived";
export type Document = typeof documents.$inferSelect;

async function uniqueSlug(orgId: string, title: string): Promise<string> {
  const base = slugify(title);
  let slug = base;
  let n = 1;
  for (;;) {
    const [existing] = await db
      .select({ id: documents.id })
      .from(documents)
      .where(and(eq(documents.orgId, orgId), eq(documents.slug, slug)));
    if (!existing) return slug;
    slug = `${base}-${++n}`;
  }
}

export function listDocuments(
  orgId: string,
  opts?: { categoryId?: string; status?: DocStatus },
) {
  const conds = [eq(documents.orgId, orgId)];
  if (opts?.categoryId) conds.push(eq(documents.categoryId, opts.categoryId));
  if (opts?.status) conds.push(eq(documents.status, opts.status));
  return db
    .select({
      id: documents.id,
      title: documents.title,
      status: documents.status,
      docType: documents.docType,
      categoryName: categories.name,
      categoryColor: categories.color,
      updatedAt: documents.updatedAt,
    })
    .from(documents)
    .leftJoin(categories, eq(documents.categoryId, categories.id))
    .where(and(...conds))
    .orderBy(desc(documents.updatedAt));
}

export async function getDocument(orgId: string, id: string) {
  const [row] = await db
    .select()
    .from(documents)
    .where(and(eq(documents.id, id), eq(documents.orgId, orgId)));
  return row ?? null;
}

export async function createDocument(params: {
  orgId: string;
  title: string;
  categoryId: string | null;
  bodyJson: unknown;
  bodyHtml: string;
  createdBy: string;
}): Promise<string> {
  const slug = await uniqueSlug(params.orgId, params.title);
  const [row] = await db
    .insert(documents)
    .values({
      orgId: params.orgId,
      title: params.title.trim(),
      slug,
      categoryId: params.categoryId,
      docType: "authored",
      body: params.bodyJson,
      bodyHtml: params.bodyHtml,
      status: "draft",
      createdBy: params.createdBy,
      updatedBy: params.createdBy,
    })
    .returning({ id: documents.id });
  return row.id;
}

export async function updateDocument(params: {
  orgId: string;
  id: string;
  title: string;
  categoryId: string | null;
  bodyJson: unknown;
  bodyHtml: string;
  updatedBy: string;
}): Promise<void> {
  await db
    .update(documents)
    .set({
      title: params.title.trim(),
      categoryId: params.categoryId,
      body: params.bodyJson,
      bodyHtml: params.bodyHtml,
      updatedBy: params.updatedBy,
      updatedAt: new Date(),
    })
    .where(and(eq(documents.id, params.id), eq(documents.orgId, params.orgId)));
}

/** Snapshot the current content as a version and mark the doc published. */
export async function publishDocument(params: {
  orgId: string;
  id: string;
  userId: string;
}): Promise<void> {
  const doc = await getDocument(params.orgId, params.id);
  if (!doc) return;

  await db.insert(documentVersions).values({
    documentId: doc.id,
    version: doc.currentVersion,
    body: doc.body,
    bodyHtml: doc.bodyHtml,
    createdBy: params.userId,
  });
  await db
    .update(documents)
    .set({
      status: "published",
      currentVersion: doc.currentVersion + 1,
      updatedBy: params.userId,
      updatedAt: new Date(),
    })
    .where(eq(documents.id, doc.id));
}

export async function deleteDocument(params: {
  orgId: string;
  id: string;
}): Promise<void> {
  await db
    .delete(documents)
    .where(and(eq(documents.id, params.id), eq(documents.orgId, params.orgId)));
}
