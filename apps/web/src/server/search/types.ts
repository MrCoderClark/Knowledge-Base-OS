export type SearchType = "document" | "video";

export type SearchHit = {
  id: string;
  type: SearchType;
  title: string;
  /** Excerpt with matches wrapped in {{ … }} markers (rendered, never HTML). */
  snippet: string;
  categoryId: string | null;
  score: number;
  updatedAt: string;
  href: string;
};

export type SearchQuery = {
  orgId: string;
  text: string;
  limit?: number;
};

/**
 * Search abstraction — all callers depend on this, never on a concrete engine.
 * Phase 1 is Postgres FTS (`PgFtsProvider`); Phase 2 swaps in a pgvector hybrid
 * behind the same interface (see docs/specs/04-search.md).
 */
export interface SearchProvider {
  search(q: SearchQuery): Promise<{ hits: SearchHit[] }>;
  /** Upsert on write. No-op in P1 (tsvector is computed on read). */
  index(): Promise<void>;
  /** Remove on delete. No-op in P1. */
  remove(): Promise<void>;
}
