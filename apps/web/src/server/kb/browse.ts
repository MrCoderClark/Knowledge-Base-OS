import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/server/db";
import { categories, documents, users, videos } from "@/server/db/schema";

export type BrowseItem = {
  kind: "document" | "video";
  id: string;
  title: string;
  docType: string;
  mimeType: string | null;
  posterKey: string | null;
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
    kind: "document" as const,
    id: r.id,
    title: r.title,
    docType: r.docType,
    mimeType: r.mimeType,
    posterKey: null,
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

export async function browseVideos(
  orgId: string,
  opts: { categorySlug?: string } = {},
): Promise<BrowseItem[]> {
  const conds = [eq(videos.orgId, orgId), eq(videos.status, "ready")];
  if (opts.categorySlug) conds.push(eq(categories.slug, opts.categorySlug));

  const rows = await db
    .select({
      id: videos.id,
      title: videos.title,
      mimeType: videos.mimeType,
      posterKey: videos.posterKey,
      categoryName: categories.name,
      categoryColor: categories.color,
      authorName: users.name,
      authorImage: users.image,
      updatedAt: videos.updatedAt,
    })
    .from(videos)
    .leftJoin(categories, eq(videos.categoryId, categories.id))
    .leftJoin(users, eq(videos.createdBy, users.id))
    .where(and(...conds))
    .orderBy(desc(videos.updatedAt));

  return rows.map((r) => ({
    kind: "video" as const,
    id: r.id,
    title: r.title,
    docType: "video",
    mimeType: r.mimeType,
    posterKey: r.posterKey,
    categoryName: r.categoryName,
    categoryColor: r.categoryColor,
    authorName: r.authorName,
    authorImage: r.authorImage,
    updatedAt: r.updatedAt,
    excerpt: "Video recording",
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
