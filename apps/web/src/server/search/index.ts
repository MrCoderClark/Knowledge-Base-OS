import { PgFtsProvider } from "./pg-fts";
import type { SearchProvider } from "./types";

export type { SearchHit, SearchQuery, SearchProvider, SearchType } from "./types";

let provider: SearchProvider | null = null;

/**
 * Resolve the active search provider. Phase 1 = Postgres FTS; Phase 2 will
 * return a pgvector hybrid provider here without changing any caller.
 */
export function getSearchProvider(): SearchProvider {
  if (!provider) provider = new PgFtsProvider();
  return provider;
}
