# Spec 04 — Search

Status: Draft · Phase: 1 (FTS) → 2 (hybrid) · Owner: TBD

Global command-K search over documents, videos, and procedures. Built behind one
interface so Phase 1 ships on Postgres with zero extra infra, and Phase 2 adds semantic
/ hybrid retrieval **without changing callers**.

## 1. The SearchProvider interface

```ts
// src/server/search/types.ts
export interface SearchQuery {
  orgId: string;
  actor: Actor;                 // for permission-scoped results
  text: string;
  types?: ("document" | "video" | "collection")[];
  categoryId?: string;
  limit?: number;               // default 20
  cursor?: string;
}

export interface SearchHit {
  id: string;
  type: "document" | "video" | "collection";
  title: string;
  snippet: string;              // highlighted excerpt
  categoryId?: string;
  score: number;
  updatedAt: string;
}

export interface SearchProvider {
  search(q: SearchQuery): Promise<{ hits: SearchHit[]; nextCursor?: string }>;
  index(entity: Indexable): Promise<void>;   // upsert on write
  remove(type: string, id: string): Promise<void>;
}
```

All UI and route handlers depend on `SearchProvider`, resolved from a factory —
never on a concrete engine.

## 2. Phase 1 — `PgFtsProvider` (Postgres FTS + pg_trgm)

- `documents.search_tsv` / `videos.search_tsv` are generated `tsvector` columns
  (`title` weighted A, body/transcript weighted B), GIN-indexed.
- Query: `websearch_to_tsquery` against `search_tsv`, ranked with `ts_rank_cd`.
- **Typo tolerance / prefix:** `pg_trgm` similarity on titles unions with the FTS
  results so short/misspelled command-K queries still match.
- **Snippets:** `ts_headline` for highlighted excerpts.
- **Permission scoping:** the provider filters by `org_id` and joins visibility/team
  rules so a user only ever sees hits they may open. Security is enforced in the query,
  not post-filtered.
- **Freshness:** `index()`/`remove()` are cheap (the tsvector is generated on write), so
  they're effectively no-ops in P1 but keep the interface honest for P2.

Performance target: p95 < 150 ms for typical org corpora; revisit engine choice if a
tenant's corpus outgrows FTS.

## 3. Phase 2 — hybrid (pgvector) via the same interface

- New `HybridProvider` wraps keyword FTS + **vector** similarity and fuses them
  (reciprocal-rank fusion) into one ranked list.
- **Embedding pipeline (Python service):** on document publish / video transcription,
  enqueue an `embed` job → chunk text → embed → store in `document_chunks` /
  `video_chunks` (`embedding vector(N)`, HNSW index). See [`02-data-model.md`](./02-data-model.md).
- Callers still call `provider.search(...)`; only the factory wiring changes.
- The same chunk store powers the **RAG chatbot** (retrieval step) — search and the AI
  helper share one retrieval layer.

## 4. Command-K UX (both phases)

- `cmdk`-based palette, global `⌘K` / `Ctrl+K`.
- Grouped results (Documents / Videos / Collections), keyboard navigable.
- Debounced (~150 ms), shows recent + suggested when empty.
- Result click → deep link to the item; respects permissions (no forbidden hits shown).

## Acceptance criteria

- [ ] `SearchProvider` interface exists; all callers depend on it, not on Postgres.
- [ ] `PgFtsProvider` returns ranked, highlighted, **org- and permission-scoped** hits.
- [ ] Misspelled/short queries still surface expected titles (pg_trgm path).
- [ ] Command-K works globally with keyboard nav and grouped results.
- [ ] Swapping to `HybridProvider` in Phase 2 requires no caller changes (interface holds).
