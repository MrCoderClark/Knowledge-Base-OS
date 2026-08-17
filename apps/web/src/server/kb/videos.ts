import { and, desc, eq, ne } from "drizzle-orm";
import { db } from "@/server/db";
import { categories, users, videos } from "@/server/db/schema";
import { deleteFile } from "@/server/storage";
import { slugify } from "./categories";

export type Video = typeof videos.$inferSelect;

async function uniqueSlug(orgId: string, title: string): Promise<string> {
  const base = slugify(title);
  let slug = base;
  let n = 1;
  for (;;) {
    const [existing] = await db
      .select({ id: videos.id })
      .from(videos)
      .where(and(eq(videos.orgId, orgId), eq(videos.slug, slug)));
    if (!existing) return slug;
    slug = `${base}-${++n}`;
  }
}

export function listVideos(orgId: string) {
  return db
    .select({
      id: videos.id,
      title: videos.title,
      status: videos.status,
      categoryName: categories.name,
      categoryColor: categories.color,
      updatedAt: videos.updatedAt,
    })
    .from(videos)
    .leftJoin(categories, eq(videos.categoryId, categories.id))
    .where(eq(videos.orgId, orgId))
    .orderBy(desc(videos.updatedAt));
}

export async function getVideo(orgId: string, id: string) {
  const [row] = await db
    .select()
    .from(videos)
    .where(and(eq(videos.id, id), eq(videos.orgId, orgId)));
  return row ?? null;
}

/** Video plus display metadata (category + author) for the detail page. */
export async function getVideoWithMeta(orgId: string, id: string) {
  const [row] = await db
    .select({
      id: videos.id,
      title: videos.title,
      description: videos.description,
      categoryId: videos.categoryId,
      mimeType: videos.mimeType,
      durationSeconds: videos.durationSeconds,
      createdAt: videos.createdAt,
      categoryName: categories.name,
      categoryColor: categories.color,
      authorName: users.name,
    })
    .from(videos)
    .leftJoin(categories, eq(videos.categoryId, categories.id))
    .leftJoin(users, eq(videos.createdBy, users.id))
    .where(and(eq(videos.id, id), eq(videos.orgId, orgId)));
  return row ?? null;
}

/** Other videos for the "Up Next" rail (newest first, excluding current). */
export function relatedVideos(orgId: string, currentId: string, limit = 6) {
  return db
    .select({
      id: videos.id,
      title: videos.title,
      durationSeconds: videos.durationSeconds,
      categoryName: categories.name,
    })
    .from(videos)
    .leftJoin(categories, eq(videos.categoryId, categories.id))
    .where(
      and(
        eq(videos.orgId, orgId),
        eq(videos.status, "ready"),
        ne(videos.id, currentId),
      ),
    )
    .orderBy(desc(videos.createdAt))
    .limit(limit);
}

export async function createUploadedVideo(params: {
  orgId: string;
  title: string;
  description: string | null;
  categoryId: string | null;
  fileKey: string;
  mimeType: string;
  sizeBytes: number;
  durationSeconds: number | null;
  createdBy: string;
}): Promise<string> {
  const slug = await uniqueSlug(params.orgId, params.title);
  const [row] = await db
    .insert(videos)
    .values({
      orgId: params.orgId,
      title: params.title.trim(),
      slug,
      description: params.description,
      categoryId: params.categoryId,
      fileKey: params.fileKey,
      mimeType: params.mimeType,
      sizeBytes: params.sizeBytes,
      durationSeconds: params.durationSeconds,
      status: "ready",
      createdBy: params.createdBy,
      updatedBy: params.createdBy,
    })
    .returning({ id: videos.id });
  return row.id;
}

export async function updateVideo(params: {
  orgId: string;
  id: string;
  title: string;
  description: string | null;
  categoryId: string | null;
  updatedBy: string;
}): Promise<void> {
  await db
    .update(videos)
    .set({
      title: params.title.trim(),
      description: params.description,
      categoryId: params.categoryId,
      updatedBy: params.updatedBy,
      updatedAt: new Date(),
    })
    .where(and(eq(videos.id, params.id), eq(videos.orgId, params.orgId)));
}

export async function deleteVideo(params: {
  orgId: string;
  id: string;
}): Promise<void> {
  const video = await getVideo(params.orgId, params.id);
  if (!video) return;
  if (video.fileKey) await deleteFile(video.fileKey);
  await db
    .delete(videos)
    .where(and(eq(videos.id, video.id), eq(videos.orgId, params.orgId)));
}
