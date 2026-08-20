import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { db } from "@/server/db";
import { documents, videos } from "@/server/db/schema";
import type { SearchHit, SearchProvider, SearchQuery } from "./types";

// ts_headline markers — NOT html. The UI splits on these and renders <mark>,
// so document text is never injected as HTML (no XSS surface).
const HEADLINE_OPTS =
  "StartSel={{, StopSel=}}, MaxWords=26, MinWords=10, MaxFragments=1, FragmentDelimiter= … ";

/** Postgres full-text search over documents + videos (org-scoped). */
export class PgFtsProvider implements SearchProvider {
  async search(q: SearchQuery): Promise<{ hits: SearchHit[] }> {
    const text = q.text.trim();
    if (text.length < 2) return { hits: [] };
    const limit = q.limit ?? 20;
    const like = `%${text}%`;
    const tsquery = sql`websearch_to_tsquery('english', ${text})`;

    // Documents — title (A) + stripped body_html (B). Published only.
    const docBody = sql`regexp_replace(coalesce(${documents.bodyHtml}, ''), '<[^>]+>', ' ', 'g')`;
    const docTsv = sql`setweight(to_tsvector('english', coalesce(${documents.title}, '')), 'A') || setweight(to_tsvector('english', ${docBody}), 'B')`;
    const docRank = sql<number>`ts_rank_cd(${docTsv}, ${tsquery})`;

    const docRows = await db
      .select({
        id: documents.id,
        title: documents.title,
        categoryId: documents.categoryId,
        updatedAt: documents.updatedAt,
        score: docRank.mapWith(Number),
        snippet: sql<string>`ts_headline('english', ${docBody}, ${tsquery}, ${HEADLINE_OPTS})`,
      })
      .from(documents)
      .where(
        and(
          eq(documents.orgId, q.orgId),
          eq(documents.status, "published"),
          or(sql`${docTsv} @@ ${tsquery}`, ilike(documents.title, like)),
        ),
      )
      .orderBy(desc(docRank), desc(documents.updatedAt))
      .limit(limit);

    // Videos — title (A) + description + transcript (B). Ready only.
    const vidBody = sql`concat_ws(' ', coalesce(${videos.description}, ''), coalesce(${videos.transcript}, ''))`;
    const vidTsv = sql`setweight(to_tsvector('english', coalesce(${videos.title}, '')), 'A') || setweight(to_tsvector('english', ${vidBody}), 'B')`;
    const vidRank = sql<number>`ts_rank_cd(${vidTsv}, ${tsquery})`;

    const vidRows = await db
      .select({
        id: videos.id,
        title: videos.title,
        categoryId: videos.categoryId,
        updatedAt: videos.updatedAt,
        score: vidRank.mapWith(Number),
        snippet: sql<string>`ts_headline('english', ${vidBody}, ${tsquery}, ${HEADLINE_OPTS})`,
      })
      .from(videos)
      .where(
        and(
          eq(videos.orgId, q.orgId),
          eq(videos.status, "ready"),
          or(sql`${vidTsv} @@ ${tsquery}`, ilike(videos.title, like)),
        ),
      )
      .orderBy(desc(vidRank), desc(videos.updatedAt))
      .limit(limit);

    const hits: SearchHit[] = [
      ...docRows.map((r) => ({
        id: r.id,
        type: "document" as const,
        title: r.title,
        snippet: r.snippet,
        categoryId: r.categoryId,
        score: r.score,
        updatedAt: r.updatedAt.toISOString(),
        href: `/documents/${r.id}`,
      })),
      ...vidRows.map((r) => ({
        id: r.id,
        type: "video" as const,
        title: r.title,
        snippet: r.snippet,
        categoryId: r.categoryId,
        score: r.score,
        updatedAt: r.updatedAt.toISOString(),
        href: `/videos/${r.id}`,
      })),
    ];

    hits.sort((a, b) => b.score - a.score || b.updatedAt.localeCompare(a.updatedAt));
    return { hits: hits.slice(0, limit) };
  }

  async index(): Promise<void> {
    /* no-op in P1 — tsvector is computed on read */
  }
  async remove(): Promise<void> {
    /* no-op in P1 */
  }
}
