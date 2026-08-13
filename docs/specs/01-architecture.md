# Spec 01 — Architecture

Status: Draft · Phase: 0–1 · Owner: TBD

## Goal

Define the system shape, the split between the Next.js app backend and the Phase-2
Python service, the repository layout, and environments.

## 1. System overview

```
                    ┌─────────────────────────────────────────┐
   Browser ───────► │  Next.js (App Router)                    │
   (command-K,      │  • RSC pages + client components         │
    dashboard,      │  • Route Handlers / Server Actions (CRUD)│
    viewers)        │  • Auth.js session + RBAC guards         │
                    │  • SearchProvider (FTS in P1)            │
                    └───────┬───────────────┬─────────────────┘
                            │               │ presigned URLs
                            ▼               ▼
                    ┌───────────────┐  ┌─────────────────────┐
                    │ Neon Postgres │  │ Neon Object Storage │
                    │  + Drizzle    │  │  (docs, videos)     │
                    │  FTS/pg_trgm  │  └─────────────────────┘
                    │  pgvector(P2) │
                    └───────▲───────┘
                            │ read/write (embeddings, jobs)
                    ┌───────┴───────────────────────────┐
   PHASE 2 ────────►│ Python FastAPI service            │
                    │  • video transcode/transcribe     │
                    │  • chunk + embed → pgvector        │
                    │  • RAG chatbot endpoint            │
                    │  • job worker (queue)             │
                    └───────────────────────────────────┘
```

## 2. Backend boundary (the important decision)

**Next.js owns the common path. Python owns heavy + AI work only.**

- **Next.js backend (Phase 1, all CRUD):** documents, videos metadata, categories,
  collections, users, teams, roles, activity, analytics reads, presigned upload URLs,
  keyword search. Talks to Postgres directly via Drizzle. Guards every call with RBAC.
- **Python FastAPI service (Phase 2 only):** long-running / compute-heavy / AI work —
  video transcode to HLS, thumbnail extraction, speech-to-text, document chunking +
  embedding into pgvector, and the RAG chatbot endpoint. Runs as its own deployable
  with a job worker.

**Contract between them (Phase 2):**
- Next.js enqueues jobs (e.g. "process video X", "embed document Y") and stores job
  status rows in Postgres; the Python worker consumes and writes results back to
  Postgres/Object Storage.
- Chatbot: Next.js proxies a `/chat` request to the Python service (server-to-server,
  authenticated with a shared service token); Python does retrieval + LLM call and
  streams the answer back.
- No direct browser→Python calls in the normal flow; Next.js is the single front door.

Until Phase 2, **no Python exists** — nothing in Phase 1 should depend on it. The
`SearchProvider` interface and a `jobs` table are the only seams we pre-build so the
Python service can slot in without refactors.

## 3. Repository layout

Monorepo (single repo, service folders). Phase 1 only creates `apps/web`.

```
knowledgeBase/
├─ docs/                      # PLAN.md, DESIGN.md, specs/
├─ apps/
│  ├─ web/                    # Next.js app (Phase 1)
│  │  ├─ src/app/             # routes (App Router)
│  │  ├─ src/components/      # UI components (design system)
│  │  ├─ src/server/          # server-only: db, auth, rbac, services
│  │  │  ├─ db/               # Drizzle schema + migrations + client
│  │  │  ├─ auth/             # Auth.js config, session helpers
│  │  │  ├─ rbac/             # permission catalog + guards
│  │  │  ├─ search/           # SearchProvider interface + PgFtsProvider
│  │  │  └─ services/         # documents, videos, collections, ...
│  │  ├─ src/lib/             # shared client/server utils
│  │  └─ src/styles/          # tailwind theme (from DESIGN.md)
│  └─ ai/                     # Python FastAPI service (Phase 2)
├─ packages/
│  └─ shared/                 # shared TS types / zod schemas (as needed)
└─ package.json               # workspaces
```

## 4. Key libraries

- **Data:** `drizzle-orm`, `drizzle-kit`, `@neondatabase/serverless`.
- **Auth:** `next-auth` (Auth.js v5), `@auth/drizzle-adapter`.
- **Validation:** `zod` on every route/action boundary.
- **UI:** Tailwind v4, headless primitives (Radix) for menus/dialogs/tabs,
  `lucide-react` (2px stroke icons, matches DESIGN.md), `cmdk` for command-K.
- **Files:** AWS S3 SDK (S3-compatible) against Neon Object Storage; presigned PUT/GET.
- **Testing:** Vitest (unit), Playwright (e2e).

## 5. Environments

- **Neon branching:** a Postgres branch per environment (`dev`, `preview`, `prod`);
  preview deployments get an ephemeral branch.
- **Secrets:** `DATABASE_URL`, `AUTH_SECRET`, OAuth client IDs/secrets, object-storage
  keys, and (Phase 2) `AI_SERVICE_URL` + `AI_SERVICE_TOKEN`.
- **Config:** all secrets via env; no secrets committed. `.env.example` maintained.

## 6. Cross-cutting concerns

- **Multi-tenancy:** every domain row carries `org_id`; every query is scoped to the
  caller's org. RBAC checked in the service layer, not just the UI.
- **Auditing:** all mutations emit an `activity` event (actor, verb, target, org).
- **Error handling:** typed results at the service boundary; user-safe messages in UI.
- **Observability:** structured logs; request IDs; (later) tracing across web↔Python.

## Acceptance criteria (Phase 0–1)

- [ ] `apps/web` boots with the design-system shell (sidebar + command-K + canvas).
- [ ] Drizzle connects to Neon; migrations run; seed script creates an org + admin.
- [ ] Auth.js login works; session available in RSC and route handlers.
- [ ] Presigned upload round-trips a file to Neon Object Storage.
- [ ] `SearchProvider` interface exists with a working `PgFtsProvider`.
- [ ] A `jobs` table exists (unused in P1) ready for the Phase-2 worker.
