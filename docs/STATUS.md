# KnowledgeOS — Status

Living tracker of what's **done**, **outstanding**, and **next**. Update this at the end
of each phase/slice. Plan + specs: [`PLAN.md`](./PLAN.md) · [`specs/`](./specs).

_Last updated: 2026-08-19 (Training slice A merged; **LMS Wave 1** built on branch
`phase-1-training-b`)._

**Current branch:** `phase-1-training-b` (unmerged). **Working on:** Training/LMS →
enterprise LMS roadmap (5 waves). **Do next:** verify + commit **Wave 1**
(watch-to-complete + resume), then Wave 2 (enrollment/assignment/My Learning).

---

## Snapshot

| Track | State |
|---|---|
| Phase 0 — Foundations | ✅ merged to `main` |
| Phase 1a — Auth (production) | ✅ merged to `main` |
| Phase 1 — Core KB | 🟡 partial (Categories, Documents, Videos, Browse done) |
| Phase 2 — Video pipeline | ✅ merged to `main` (2a→2d-ii) |
| **Training / LMS** | 🚧 in progress — slice A merged; **Wave 1 built** on `phase-1-training-b` |
| Phase 2 — AI (2e) | ⬜ not started |
| Phase 3 — Enterprise hardening | ⬜ not started |

---

## ✅ Completed (merged to `main`)

### Phase 0 — Foundations
- Next.js 16 + TS + Tailwind v4 app shell (sidebar, command-K bar, canvas); design tokens.
- Drizzle ORM + Neon Postgres; migrations + seed.

### Phase 1a — Auth (production; see [`specs/07`](./specs/07-auth-security.md), [`reviews`](./reviews/auth-security-review.md))
- Credentials-only, **admin-provisioned** (no OAuth, no self-signup).
- Custom **server-side sessions** (hashed tokens, idle/absolute expiry, revoke, device list).
- **Argon2id** passwords; invite → set-password; forgot/reset; change password; `/account/security`.
- **Redis rate limiting** + lockout; CSRF/Origin + **nonce CSP** + security headers; audit events.
- Tests: Vitest unit + pglite integration/security (24).

### Phase 1 — Core KB (partial)
- **RBAC layer**: permission catalog + role matrix; `requirePermission`.
- **Categories**: CRUD (RBAC-aware), confirm-on-delete.
- **Documents**: authored (Tiptap, sanitized HTML) + uploaded files; versioning; list/view/edit; browse.
- **Knowledge Base browse**: card grid + filters + grid/list toggle (matches `Browse.png`).
- **Reusable** `ConfirmDialog` (Radix).

### Phase 2 — Video pipeline (self-hosted; see [`specs/08`](./specs/08-video-processing.md))
- **Infra**: MinIO (S3) + RabbitMQ via Docker Compose; `apps/ai` FastAPI + Celery (uv).
- **Worker (ffmpeg)**: MP4 transcode, **adaptive HLS ladder**, poster, **scrub sprites**,
  **Whisper** captions/transcript/heuristic chapters. `jobs` table drives status.
- **Player (Vidstack)**: HLS (bundled hls.js), scrub thumbnails, captions, **clickable
  chapters**, **interactive transcript** (click-to-seek + search + current-line highlight).
- Processing/ready/failed UI + retry; rich detail page (matches `Video.png`).

---

## 🎓 Training / LMS — NEW DIRECTION (decided 2026-08-17)

Turn the KB into a **training platform**: **Courses → Lessons** (LMS-lite), admins build
courses from uploaded videos. **This supersedes/absorbs "Collections"** (a course is a
structured, ordered collection with completion) and **redefines "Continue Learning"** to be
course-based (not standalone videos). Leverages the per-video **transcripts** from 2d.

**Slice A — DONE (on `phase-1-training`, verify + commit):**
- [x] **Data model** — `courses`, `course_lessons`, `enrollments`, `lesson_completions`, `learning_progress` (+ enums). `course:manage` permission added.
- [x] **Course builder** (admin) — create course, add lessons from ready videos, reorder (↑/↓), remove, publish/unpublish, delete.
- [x] **Course catalog** (`/courses`, sidebar "Training") + **course viewer** (`/courses/[id]`): lesson sidebar, player (HLS/mp4 + captions/thumbnails), **Mark complete & continue**, progress bar.
- Key files: `server/kb/courses.ts`, `server/kb/course-actions.ts`, `app/(app)/courses/*`.
- Note: viewer imports player from `../../videos/` (VideoPlayer, player-context).

### Enterprise LMS roadmap (decided 2026-08-19) — 5 waves, branch/commit each

Full plan: watch-to-complete, resume, enrollment/assignment, compliance & certificates,
analytics, quizzes, Trailhead-style badges, notes, notifications. Ships wave by wave.

**Wave 1 — Watch-to-complete + Resume — BUILT (verify + commit on `phase-1-training-b`):**
- [x] **Progress service** `server/kb/progress.ts` — `upsertVideoProgress` (pct = max-ever),
  `getVideoProgress`, `getVideoProgressMap`, `continueLearning`. Enrollment helpers in
  `server/kb/enrollments.ts` (`ensureEnrollment`, `completeEnrollmentIfDone`, …).
- [x] **Progress API** `POST /api/videos/[id]/progress` (auth + org-scoped).
- [x] **Player wiring** (`videos/VideoPlayer.tsx`) — resume seek, throttled save (~10s) +
  `sendBeacon` on tab-hide, auto-complete at **≥95% / `ended`**. Resume added to standalone
  video page too.
- [x] **Manual button removed** — new `courses/LessonPlayer.tsx` (auto-complete + "Up next"
  autoplay countdown); course viewer shows **per-lesson %** + resume markers; auto-enroll on
  open; enrollment auto-completes when all lessons done.
- [x] **Dashboard Continue Learning** = real in-progress courses (`app/(app)/page.tsx`).
- No migration (tables already existed). Other dashboard KPIs/Recently-Added/Activity still mock.

**Wave 2 — Enrollment, Assignment, My Learning** · migration (enrollments +cols, notifications):
self-enroll + admin/team **assign** + **due dates/overdue**, in-app **notifications**,
**/my-learning** hub, course **overview page**.

**Wave 3 — Compliance, Certificates, Analytics, Anti-skip** · migration: **certificates** +
verify page, **required-training + compliance dashboard**, **admin analytics + CSV export**,
**anti-skip** enforcement.

**Wave 4 — Quizzes & pass-gating** · migration: quiz authoring/taking + gating.

**Wave 5 — Gamification, Notes, Email** · migration: **Trailhead-style badges + points**,
**timestamped notes**, **email reminders** (existing sender).

**AI-assisted (was slice C; now folds into a later wave / Phase 2e):** course-outline
generation, video-to-lesson suggestions, content-gap ideas. Needs `ANTHROPIC_API_KEY` in `apps/ai`.

---

## ⬜ Outstanding

### Phase 1 — Core KB (remaining)
- [ ] ~~**Collections**~~ → **superseded by Courses** (Training/LMS above).
- [ ] **Dashboard real data** — KPIs, Recently Added, Recent Activity, **Continue Learning** (currently mock).
- [ ] **Users module (full)** — role changes, suspend/remove, **lock status + unlock** (clears DB **and** Redis — spec'd in [`05`](./specs/05-features.md)/[`07`](./specs/07-auth-security.md)).
- [ ] **Teams**, **Activity** feed (needs `activity_events` logging), **Analytics**, **Settings**, **Permissions** UI.
- [ ] **Search** — command-K over docs/videos (Postgres FTS; see [`04`](./specs/04-search.md)).

### Video — product features
- [ ] **Watch-progress + resume** → powers Continue Learning.
- [ ] **View counts** (Most Viewed) · **persistent Like/Save** · **CDN/presigned** delivery · resumable uploads · custom poster/chapter editing.

### AI track (Python service + Claude)
- [ ] **LMS assist** — AI course-outline generation, video-to-lesson suggestions, content-gap ideas (see Training section).
- [ ] Transcripts → **semantic search / RAG chatbot** (pgvector; original AI goal).
- [ ] Auto-summaries / auto-tags / quiz generation.
- Prereq: `ANTHROPIC_API_KEY` in `apps/ai`.

### Phase 3 — Enterprise hardening
- [ ] MFA (TOTP/passkeys), SSO/SAML/SCIM, audit/retention/export, approval workflows.

---

## ⚠️ Pre-production must-dos (flagged during build)
- [ ] Rotate dev-exposed secrets: **Neon password**, **Gmail app password**, seeded admin password.
- [ ] Suspend action must set `user.status='suspended'` so the session guard picks it up (auth review R3).
- [ ] Serve over HTTPS; secrets in a manager; trusted `X-Forwarded-For`; MinIO behind CDN.

---

## ▶️ Next up
1. **Verify + commit Training slice A** on `phase-1-training` (then keep going on that branch).
2. **Training slice B** — enrollment, auto-complete-on-watch, **Continue Learning**, **Dashboard real data** (recreate `server/kb/progress.ts`).
3. **Training slice C** — AI course generation (Python `apps/ai` + Claude; needs `ANTHROPIC_API_KEY`).
4. Merge `phase-1-training` → `main` at a stable point.

## How to run everything (dev)
- **Web:** `apps/web` → `bun run dev` (port 3001). Env in `apps/web/.env.local`.
- **Infra:** repo root → `docker compose up -d` (RabbitMQ + MinIO).
- **AI/media service:** `apps/ai` → `uv run uvicorn app.main:app --port 8001 --reload` **and** `uv run celery -A app.celery_app worker --pool=solo --loglevel=info`. Env in `apps/ai/.env`.
- **DB migrations:** `apps/web` → `bun run db:generate` then `bun run db:migrate`.
- **Git:** run from repo **root**. User runs all commands; branch per phase (`phase-<N>-<topic>`, whole phase on one branch).
