import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/server/db";
import { categories, documents, users } from "@/server/db/schema";

export type BrowseItem = {
  id: string;
  title: string;
  docType: string;
  mimeType: string | null;
  categoryName: string | null;
  categoryColor: string | null;
  excerpt: string;
  authorName: string | null;
  authorImage: string | null;
  updatedAt: Date;
};

function excerptFromHtml(html: string | null): string {
  if (!html) return "";
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 160);
}

export async function browseDocuments(
  orgId: string,
  opts: { categorySlug?: string; pdfOnly?: boolean } = {},
): Promise<BrowseItem[]> {
  const conds = [eq(documents.orgId, orgId), eq(documents.status, "published")];
  if (opts.categorySlug) conds.push(eq(categories.slug, opts.categorySlug));
  if (opts.pdfOnly) conds.push(eq(documents.mimeType, "application/pdf"));

  const rows = await db
    .select({
      id: documents.id,
      title: documents.title,
      docType: documents.docType,
      mimeType: documents.mimeType,
      bodyHtml: documents.bodyHtml,
      categoryName: categories.name,
      categoryColor: categories.color,
      authorName: users.name,
      authorImage: users.image,
      updatedAt: documents.updatedAt,
    })
    .from(documents)
    .leftJoin(categories, eq(documents.categoryId, categories.id))
    .leftJoin(users, eq(documents.createdBy, users.id))
    .where(and(...conds))
    .orderBy(desc(documents.updatedAt));

  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    docType: r.docType,
    mimeType: r.mimeType,
    categoryName: r.categoryName,
    categoryColor: r.categoryColor,
    authorName: r.authorName,
    authorImage: r.authorImage,
    updatedAt: r.updatedAt,
    excerpt:
      r.docType === "uploaded"
        ? (r.mimeType ?? "File")
        : excerptFromHtml(r.bodyHtml),
  }));
}

export type CategoryCount = {
  id: string;
  name: string;
  slug: string;
  color: string | null;
  count: number;
};

export async function categoryCounts(orgId: string): Promise<CategoryCount[]> {
  return db
    .select({
      id: categories.id,
      name: categories.name,
      slug: categories.slug,
      color: categories.color,
      count: sql<number>`count(${documents.id})`.mapWith(Number),
    })
    .from(categories)
    .leftJoin(
      documents,
      and(
        eq(documents.categoryId, categories.id),
        eq(documents.status, "published"),
      ),
    )
    .where(eq(categories.orgId, orgId))
    .groupBy(categories.id)
    .orderBy(categories.name);
}
