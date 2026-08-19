# KnowledgeOS — Build Plan

An enterprise knowledge base for documents, videos, and training/procedures with
search, multi-tenant teams, RBAC, analytics, and (Phase 2) an AI chatbot helper.

> This is the master plan. Detailed specs live in [`docs/specs/`](./specs).
> **Live progress (done / outstanding / next): [`STATUS.md`](./STATUS.md)** — kept current each phase.
> Visual language lives in [`DESIGN.md`](./DESIGN.md) and the `Dashboard.png` reference.

---

## 1. Product summary

A single place where an organization stores, organizes, finds, and learns from its
knowledge — long-form documents, videos/training modules, procedures — organized into
categories and collections, secured per team/role, and searchable from a global
command-K bar. Dashboard surfaces "Continue Learning", recent activity, and KPIs.

Primary modules (from the design): **Dashboard, Knowledge Base, Documents, Videos,
Categories, Collections, Search, Users, Teams, Analytics, Activity, Settings,
Permissions.**

---

## 2. Tech stack (decided)

| Concern | Choice | Notes |
|---|---|---|
| Frontend | **Next.js (App Router) + TypeScript** | RSC-first, SSR for SEO/perf |
| Styling | **Tailwind CSS v4** | Tokens generated from `DESIGN.md` |
| App backend | **Next.js Route Handlers / Server Actions** | All CRUD, auth-guarded |
| Heavy/AI backend | **Python (FastAPI) service** — *Phase 2* | RAG chatbot, video processing, embeddings |
| Auth | **Auth.js (NextAuth)** | Session + provider layer |
| Authorization | **Custom RBAC** | Org → Team → Role → Permission |
| Database | **Neon Postgres** | Serverless, branching per environment |
| ORM | **Drizzle ORM** | Typed schema + migrations |
| File/video storage | **Neon Object Storage** (S3-compatible) | Presigned uploads |
| Search | **Postgres FTS + `pg_trgm`** behind `SearchProvider` | pgvector hybrid in Phase 2 |
| Background jobs | **Next.js + queue** (Phase 1 light) → **Python worker** (Phase 2) | Transcode/transcribe/embed |
| Hosting | Vercel (web) + container host for Python service | TBD at deploy time |

See [`specs/01-architecture.md`](./specs/01-architecture.md) for the full rationale
and the exact boundary between the Next.js backend and the Python service.

---

## 3. Phased roadmap

### Phase 0 — Foundations
- Repo scaffold (Next.js, TS, Tailwind v4, ESLint/Prettier).
- Design tokens from `DESIGN.md` wired into Tailwind theme.
- Neon project + Drizzle + first migration. Object Storage bucket.
- Auth.js wired with a credentials/OAuth provider; session plumbing.
- App shell: fixed 280px sidebar + top command-K bar + content canvas.

### Phase 1 — Core KB (first release)
- **Data model** for orgs, teams, users, roles, documents, videos, categories,
  collections, activity. ([`specs/02-data-model.md`](./specs/02-data-model.md))
- **RBAC** enforced on every route/action. ([`specs/03-auth-rbac.md`](./specs/03-auth-rbac.md))
- **Documents:** upload, rich viewer, versioning, metadata, categorize.
- **Videos:** upload to object storage, basic player, poster/thumbnail.
- **Categories & Collections:** CRUD + assignment.
- **Search:** global command-K over docs/videos/procedures via Postgres FTS.
  ([`specs/04-search.md`](./specs/04-search.md))
- **Dashboard:** KPIs, Continue Learning, Recently Added, Recent Activity.
- **Users & Teams:** membership, role assignment, invitations.
- **Analytics & Activity:** event capture + basic reporting.
- **Settings & Permissions** UIs.

### Phase 2 — AI & rich media
- **Python FastAPI service** stood up as a separate deployable.
- **Video processing:** transcode to HLS, thumbnails, transcription/captions.
- **Embedding pipeline:** chunk docs + transcripts → embeddings in **pgvector**.
- **Hybrid search:** keyword + semantic behind the same `SearchProvider`.
- **AI chatbot helper:** RAG Q&A over the KB with citations.

### Phase 3 — Enterprise hardening (backlog)
- Enterprise SSO / SAML / SCIM provisioning.
- Audit logs, data retention, export.
- Fine-grained sharing, approval/publishing workflows.
- Full-text OCR for scanned docs; per-tenant analytics dashboards.

---

## 4. Spec index

| Spec | Covers |
|---|---|
| [`01-architecture.md`](./specs/01-architecture.md) | System design, repo layout, Next.js↔Python boundary, envs |
| [`02-data-model.md`](./specs/02-data-model.md) | Postgres schema, entities, relationships, migrations |
| [`03-auth-rbac.md`](./specs/03-auth-rbac.md) | Auth.js, org/team model, roles, permissions, enforcement |
| [`04-search.md`](./specs/04-search.md) | SearchProvider interface, FTS (P1), pgvector hybrid (P2) |
| [`05-features.md`](./specs/05-features.md) | Module-by-module functional specs + acceptance criteria |
| [`06-design-system.md`](./specs/06-design-system.md) | DESIGN.md → Tailwind tokens + component contracts |
| [`07-auth-security.md`](./specs/07-auth-security.md) | **Production auth** (custom server-side sessions, Argon2id, rate limiting, audit) per [`AUTHENTICATION.md`](./AUTHENTICATION.md) — supersedes the auth part of 03 |
| [`08-video-processing.md`](./specs/08-video-processing.md) | **Phase 2 media pipeline** — self-hosted Python/FastAPI + ffmpeg (transcode, HLS, thumbnails, transcription) |

---

## 5. Open decisions (to revisit)

- Rich document format: Markdown/MDX vs. block editor (Tiptap/ProseMirror) vs. file-native (PDF/Docx render). *Leaning: Tiptap for authored docs + native render for uploads.*
- Job queue for Phase 2 (Celery/RQ vs. managed). Decide when Python service is scoped.
- Hosting target for the Python service (Fly.io / Render / AWS). Decide at deploy time.
- OAuth/SSO providers for Auth.js at launch (Google/Microsoft?).
