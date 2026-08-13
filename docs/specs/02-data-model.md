# Spec 02 — Data Model

Status: Draft · Phase: 1 · Owner: TBD

Postgres (Neon) via Drizzle ORM. All timestamps `timestamptz`, all IDs `uuid`
(default `gen_random_uuid()`). Every tenant-scoped table carries `org_id` and is
always queried scoped to the caller's org.

## 1. Entities overview

```
organizations ──< teams ──< team_members >── users
      │                                        │
      ├──< memberships (user↔org + role) ──────┘
      ├──< categories ──< (documents / videos via category_id)
      ├──< collections ──< collection_items >── (document|video)
      ├──< documents ──< document_versions
      ├──< videos
      ├──< activity_events
      ├──< learning_progress (user↔video/module)
      └──< jobs                (Phase 2 seam; unused in P1)
```

## 2. Tables

### organizations
| col | type | notes |
|---|---|---|
| id | uuid pk | |
| name | text | |
| slug | text unique | URL/tenant key |
| created_at / updated_at | timestamptz | |

### users
Global identity (an Auth.js account maps here).
| col | type | notes |
|---|---|---|
| id | uuid pk | |
| email | text unique | |
| name | text | |
| avatar_url | text null | |
| created_at | timestamptz | |

> Auth.js `accounts`, `sessions`, `verification_tokens` tables per the Drizzle
> adapter, keyed to `users.id`.

### memberships  (user ↔ org, carries org-level role)
| col | type | notes |
|---|---|---|
| id | uuid pk | |
| org_id | uuid fk | |
| user_id | uuid fk | |
| role | enum `role` | owner \| admin \| editor \| viewer |
| status | enum | invited \| active \| suspended |
| invited_by | uuid fk null | |
| created_at | timestamptz | |
| | | unique(org_id, user_id) |

### teams
| col | type | notes |
|---|---|---|
| id | uuid pk | |
| org_id | uuid fk | |
| name | text | |
| description | text null | |
| created_at | timestamptz | |

### team_members  (user ↔ team, optional team-level role)
| col | type | notes |
|---|---|---|
| id | uuid pk | |
| team_id | uuid fk | |
| user_id | uuid fk | |
| role | enum `team_role` | lead \| member |
| | | unique(team_id, user_id) |

### categories
| col | type | notes |
|---|---|---|
| id | uuid pk | |
| org_id | uuid fk | |
| name | text | |
| slug | text | unique per org |
| parent_id | uuid fk null | self-ref for nesting |
| color | text null | badge hue |
| created_at | timestamptz | |

### collections
Curated groupings (e.g. "Engineering Onboarding 2024").
| col | type | notes |
|---|---|---|
| id | uuid pk | |
| org_id | uuid fk | |
| name | text | |
| description | text null | |
| cover_image_url | text null | |
| visibility | enum | org \| team \| private |
| created_by | uuid fk | |
| created_at | timestamptz | |

### collection_items  (polymorphic membership)
| col | type | notes |
|---|---|---|
| id | uuid pk | |
| collection_id | uuid fk | |
| item_type | enum | document \| video |
| item_id | uuid | fk enforced in app layer |
| position | int | ordering |
| | | unique(collection_id, item_type, item_id) |

### documents
| col | type | notes |
|---|---|---|
| id | uuid pk | |
| org_id | uuid fk | |
| title | text | |
| slug | text | unique per org |
| category_id | uuid fk null | |
| doc_type | enum | authored \| uploaded |
| body | jsonb null | authored (Tiptap JSON) |
| file_key | text null | uploaded (object-storage key) |
| mime_type | text null | |
| size_bytes | bigint null | |
| status | enum | draft \| published \| archived |
| current_version | int | |
| search_tsv | tsvector | generated; GIN index |
| created_by / updated_by | uuid fk | |
| created_at / updated_at | timestamptz | |

### document_versions
| col | type | notes |
|---|---|---|
| id | uuid pk | |
| document_id | uuid fk | |
| version | int | |
| body | jsonb null | |
| file_key | text null | |
| change_note | text null | |
| created_by | uuid fk | |
| created_at | timestamptz | |
| | | unique(document_id, version) |

### videos
| col | type | notes |
|---|---|---|
| id | uuid pk | |
| org_id | uuid fk | |
| title | text | |
| slug | text | unique per org |
| category_id | uuid fk null | |
| file_key | text | original upload key |
| hls_key | text null | Phase 2 transcode output |
| poster_key | text null | thumbnail |
| duration_seconds | int null | |
| transcript | text null | Phase 2 (also feeds search/RAG) |
| status | enum | uploaded \| processing \| ready \| failed |
| search_tsv | tsvector | generated; GIN index |
| created_by | uuid fk | |
| created_at / updated_at | timestamptz | |

### learning_progress  (Continue Learning)
| col | type | notes |
|---|---|---|
| id | uuid pk | |
| org_id | uuid fk | |
| user_id | uuid fk | |
| item_type | enum | video \| collection |
| item_id | uuid | |
| progress_pct | int | 0–100 |
| last_position_seconds | int null | resume point |
| updated_at | timestamptz | |
| | | unique(user_id, item_type, item_id) |

### activity_events  (Recent Activity + audit)
| col | type | notes |
|---|---|---|
| id | uuid pk | |
| org_id | uuid fk | |
| actor_id | uuid fk | |
| verb | enum | created \| updated \| published \| commented \| viewed \| deleted |
| target_type | enum | document \| video \| collection \| category \| user \| team |
| target_id | uuid | |
| metadata | jsonb null | e.g. comment text, diff summary |
| created_at | timestamptz | index(org_id, created_at desc) |

### jobs  (Phase 2 seam — created in P1, unused)
| col | type | notes |
|---|---|---|
| id | uuid pk | |
| org_id | uuid fk | |
| type | enum | transcode \| transcribe \| embed |
| target_type / target_id | | |
| status | enum | queued \| running \| done \| failed |
| attempts | int | |
| error | text null | |
| created_at / updated_at | timestamptz | |

### Phase 2 — embeddings (pgvector)
`document_chunks` / `video_chunks`: `(id, source_id, org_id, chunk_index, content,
embedding vector(N))` with an ivfflat/hnsw index. Added when the Python pipeline lands;
not built in Phase 1. See [`04-search.md`](./04-search.md).

## 3. Indexing

- GIN on `documents.search_tsv`, `videos.search_tsv`.
- `pg_trgm` GIN on `documents.title`, `videos.title`, `categories.name` for
  typo-tolerant prefix matching in command-K.
- Composite `(org_id, created_at desc)` on `activity_events`, `documents`, `videos`.
- All FKs indexed; unique constraints as noted.

## 4. Migrations & seed

- Drizzle Kit migrations checked into `apps/web/src/server/db/migrations`.
- Seed script: one org, one owner user, a few categories, sample documents/videos so
  the dashboard renders with real data in dev.

## Acceptance criteria

- [ ] All Phase-1 tables migrate cleanly on a fresh Neon branch.
- [ ] Every domain table has `org_id` and an org-scoped query helper.
- [ ] `search_tsv` columns populate via generated columns/triggers on write.
- [ ] Seed produces a dashboard-ready dataset.
