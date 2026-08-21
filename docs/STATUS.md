# KnowledgeOS — Status

Living tracker of what's **done**, **outstanding**, and **next**. Update this at the end
of each phase/slice. Plan + specs: [`PLAN.md`](./PLAN.md) · [`specs/`](./specs).

_Last updated: 2026-08-21. Most work is merged to `main`; the **Users module finish**
(suspend/remove + lock/unlock) is built on `phase-1-users-module` (pending verify + merge)._

**Current branch:** `phase-1-users-module`. **Do next (pick one):** video niceties (view
counts, persistent Like/Save); Phase 3 hardening (MFA, SSO/SAML/SCIM, audit/retention).
**Reserved for LAST (user's call):** the **RAG chatbot** — Python `apps/ai` + pgvector
semantic search over transcripts/docs (shares the search retrieval layer; see
[`04`](./specs/04-search.md) §3).

### Session pickup — what's DONE
- **Users module finish** (`phase-1-users-module`, pending merge): admin **suspend/remove**
  + **lock/unlock** on `/users`. Suspend flips `user.status` **and** membership to
  `suspended`, revokes sessions, and emails the user; unlock clears the DB lock **and** the
  Redis login limiter (`clearLoginLimitsForAccount`). Suspended sign-in is enumeration-safe
  (revealed only after a correct password). `server/kb/users.ts` + `user-actions.ts`.
  Also chore-fixed: `tsc --noEmit` errors (`env.ts`, `password.ts`), a stray nested
  `.next` that polluted lint (+ hardened ESLint ignore), and completed the vitest dummy env.
- **Enterprise LMS roadmap — all 5 waves complete:** (1) watch-to-complete + resume;
  (2) enrollment/assignment/notifications/My Learning; (3) certificates/compliance/analytics/
  anti-skip; (4) quizzes + pass-gating **+ AI helpers**; (5) badges/points/notes/reminders.
- **AI helpers** use an `AIProvider` abstraction (`server/ai/`, OpenRouter + Gemini, env-selected
  via `AI_PROVIDER`; free models now, Claude a drop-in later). Course-outline + quiz generation.
- **Dashboard** real org-scoped data (`server/kb/dashboard.ts`).
- **RBAC:** effective permissions = role ∪ per-member grants (`memberships.extraPermissions`,
  `authz.can()`); sidebar hides inaccessible items; **/permissions** admin UI.
- **Search (Phase 1):** `SearchProvider` + `PgFtsProvider` (Postgres FTS) + ⌘K palette + `/search`.
- **Admin pages complete (no dead nav links):** **/teams**, **/settings** (org name+slug in
  sidebar brand), **/activity** (logged `activity_events` feed).
- Bug fixes: transcript auto-scroll (container-only), video control bar (`smallLayoutWhen={false}`),
  post-login return-URL (`?next=`).

### Ops notes for a fresh session
- **User runs ALL commands** (bun, git, db:generate/db:migrate). Present exact commands; wait.
- **Branch per phase; do NOT edit files until the user confirms they're on the new branch.**
- Optional env (see `apps/web/.env.example`): `AI_PROVIDER`+key (AI helpers), `CRON_SECRET`
  (`/api/cron/reminders` due reminders). App runs fine without them.
- Latest migration is high (0013+ range); always `db:generate`/`db:migrate` after schema edits.

---

## Snapshot

| Track | State |
|---|---|
| Phase 0 — Foundations | ✅ merged to `main` |
| Phase 1a — Auth (production) | ✅ merged to `main` |
| Phase 1 — Core KB | ✅ mostly done (docs, videos, browse, **search**, dashboard, RBAC + permissions UI, teams, settings, activity) |
| Phase 2 — Video pipeline | ✅ merged to `main` (2a→2d-ii) |
| **Training / LMS** | ✅ **complete** — all 5 waves merged to `main` |
| Phase 2 — AI (2e) | 🟡 LMS AI helpers done (OpenRouter/Gemini); **RAG chatbot not started** (the finale) |
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

**Wave 2 — Enrollment, Assignment, My Learning — BUILT (migrate + verify + commit on `phase-1-training-c`):**
- [x] **Migration** — `enrollments` +`assignedBy`/`assignedTeamId`/`dueAt`; new `notifications`
  table + enum. Run `bun run db:generate` then `bun run db:migrate`.
- [x] **Assignment** — admin **assign to people and/or a team** with an optional **due date**
  (`assignCourseAction`; `enrollments.ts` `assignCourse`/`teamMemberIds`); Assign UI on the
  course **edit** page (`courses/AssignCourse.tsx`). Self-enroll on course **start**.
- [x] **Notifications** — `notifications.ts` service + `notification-actions.ts`; bell w/ unread
  badge + dropdown in the topbar (`components/shell/NotificationBell.tsx`, fetched in
  `(app)/layout.tsx`); fires on assign + course-completion; **email** via existing sender
  (`sendCourseAssignedEmail`, best-effort).
- [x] **My Learning** (`/my-learning`, sidebar) — In-progress / Assigned / Overdue / Completed
  tabs (`myCourses` in `progress.ts`); overdue = `dueAt < now`.
- [x] **Course overview page** — `/courses/[id]` with no `?lesson=` now shows syllabus +
  progress + Start/Continue CTA; the player shows when a lesson is selected.

**Wave 3 — Compliance, Certificates, Analytics, Anti-skip — BUILT (migrate + verify + commit on `phase-1-training-d`):**
- [x] **Migration** — `courses` +`required`/`antiSkip`; new `certificates` table (unique
  user+course, unique `code`). Run `bun run db:generate` then `bun run db:migrate`.
- [x] **Certificates** — `certificates.ts` (issue on completion, idempotent); public
  printable **`/verify/[code]`** page; links from My Learning (completed) + course overview;
  completion notification now points at the certificate.
- [x] **Compliance + analytics** — `analytics.ts` (`courseAnalytics`, `orgSummary`,
  `learnerProgress`); **`/analytics`** (admin, `analytics:read`) with compliance rate,
  required-training table, per-course stats; **`/analytics/[courseId]`** learner table;
  **CSV export** `GET /api/analytics/courses/[id]/csv`.
- [x] **Required + anti-skip** — course edit **Settings** toggles
  (`CourseSettings.tsx` → `setCourseFlagsAction`); player clamps forward seeks past the
  furthest-watched point when `antiSkip`; Required/No-skipping badges on the overview.

**Wave 4 — Quizzes & pass-gating + AI helpers — BUILT (migrate + AI key + verify + commit on `phase-1-training-e`):**
- [x] **AI provider abstraction** — `server/ai/` (`AIProvider` interface + `openrouter` +
  `gemini`, fetch-based, env-selected via `AI_PROVIDER`; `isAIConfigured()`). Free models
  now; Claude is a drop-in later. Optional env keys in `.env.example`.
- [x] **AI helper: course outline** — New Course page "Draft with AI" → title/description +
  suggested lessons pre-fill the builder (`ai-actions.ts` `generateCourseOutlineAction`).
- [x] **Migration** — `quizzes`, `quiz_questions`, `quiz_attempts`. Run `db:generate`/`db:migrate`.
- [x] **Quiz authoring** — course edit "Course quiz" section (`QuizEditor.tsx`): manual
  Q&A + **"Generate with AI"** from a **lesson transcript** *or* a **prompt**
  (`quiz-actions.ts` `generateQuizAction`, VTT→text; `saveQuizAction`).
- [x] **Quiz taking + gating** — `QuizPanel.tsx` on the course overview (answers graded
  **server-side**, correct answers never sent to client); passing gates course completion +
  certificate via `course-completion.ts` `finalizeCourseIfComplete` (used by both
  lesson-complete and quiz-submit).
- Note: quizzes are **course-level** (end-of-course). Per-lesson quiz gating is scaffolded
  in the schema (`quizzes.lessonId`) but not yet surfaced in the editor.

**Wave 5 — Gamification, Notes, Email reminders — BUILT (migrate + verify + commit on `phase-1-training-f`):**
- [x] **Migration** — `user_badges`, `lesson_notes`; `badge_earned` added to `notification_type`.
- [x] **Badges + points** — code-defined catalog (`badges.ts`, Trailhead-style: course
  milestones 1/3/5/10 + perfect-quiz); awarded from `finalizeCourseIfComplete` + quiz submit;
  points→rank; **Achievements** strip (rank/points/badges) on My Learning. `badge_earned` notifications.
- [x] **Timestamped notes** — `notes.ts` + `note-actions.ts`; `videos/NotesPanel.tsx` on the
  video page (add at current time, list, **click-to-seek** via player-context, delete).
- [x] **Email reminders** — `sendCourseDueReminderEmail`; `reminders.ts` (`sendDueReminders`,
  due-soon ≤3d / overdue, deduped ≤1×/20h) behind token-protected **`GET/POST /api/cron/reminders`**
  (`CRON_SECRET`). Point any external cron at it.

**AI-assisted (was slice C; now folds into a later wave / Phase 2e):** course-outline
generation, video-to-lesson suggestions, content-gap ideas. Needs `ANTHROPIC_API_KEY` in `apps/ai`.

---

## ⬜ Outstanding

### Phase 1 — Core KB (remaining)
- [ ] ~~**Collections**~~ → **superseded by Courses** (Training/LMS above).
- [x] **Dashboard real data** — org-scoped KPIs, Recently Added, Recent Activity (derived from
  recent content), Continue Learning, working quick actions (`server/kb/dashboard.ts`,
  `app/(app)/page.tsx`). Built on `phase-1-dashboard`.
- [x] **Users module (full)** (`phase-1-users-module`) — ~~role changes~~ (Permissions UI),
  **suspend/remove** + **lock status + unlock** (clears DB **and** Redis). Suspend sets
  `user.status`+membership, revokes sessions, emails the user; unlock uses
  `clearLoginLimitsForAccount`. Enumeration-safe suspended login. Last-admin + no-self
  guards. Spec'd in [`05`](./specs/05-features.md)/[`07`](./specs/07-auth-security.md).
- [x] **RBAC nav + Permissions UI** (`phase-1-nav-rbac`) — effective permissions = role ∪ per-member
  grants (`memberships.extraPermissions`, `authz.can()`); sidebar hides items you can't access;
  **`/permissions`** page to set role + toggle individual grants (last-admin guard). Admin pages
  (users, analytics) now gate via `can()`. **Analytics** page shipped in Wave 3.
- [x] **Teams** (`phase-1-teams-settings`) — `/teams` CRUD + add/remove members
  (`teams.ts`/`team-actions.ts`, `team:manage`); feeds course assign-to-team.
- [x] **Settings** (`phase-1-teams-settings`) — `/settings` org profile (edit name;
  `org.ts`/`settings-actions.ts`, `settings:manage`). Thin for now — more org fields later.
- [x] **Activity** feed (`phase-1-activity`) — `activity_events` table + `logActivity()`
  wired into publish (doc/course), video upload, course complete/assign, team create;
  `/activity` page (`activity:read`, shared feed). Migration required.
- [x] **Search** (Phase 1, `phase-1-search`) — `SearchProvider` interface + `PgFtsProvider`
  (Postgres FTS: `websearch_to_tsquery`/`ts_rank_cd`/`ts_headline` + title `ILIKE` union,
  org-scoped, published/ready only). **⌘K command palette** (`SearchPalette`) + `/search` page
  + `GET /api/search`. No migration (tsvector computed on read). **Deferred to Phase 2:** generated
  tsvector columns + GIN indexes + `pg_trgm`, and pgvector hybrid (same interface).

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
- [x] Suspend action sets `user.status='suspended'` (+ membership) and revokes sessions so the session/login guards pick it up (auth review R3) — done in `phase-1-users-module`.
- [ ] Serve over HTTPS; secrets in a manager; trusted `X-Forwarded-For`; MinIO behind CDN.

---

## ▶️ Next up (as of 2026-08-21 — Users module built on `phase-1-users-module`, pending merge)
Pick any; each on its own branch (user creates it, confirm before editing):
1. ~~**Users module finish**~~ — ✅ done on `phase-1-users-module` (suspend/remove + lock/unlock, DB **and** Redis).
2. **Video niceties** — view counts (Most Viewed), persistent Like/Save (currently local-only).
3. **Phase 3 hardening** — MFA (TOTP/passkeys), SSO/SAML/SCIM, audit/retention/export.
4. **Unify dashboard "Recent Activity"** to read the new `activity_events` table (optional polish).
5. **RESERVED FOR LAST (user's explicit call):** **RAG chatbot** — Python `apps/ai` +
   pgvector; embed transcripts/docs → retrieval → chat. Shares the `SearchProvider` layer.

_(Historical slice/wave notes below are kept for context but are all merged.)_

## How to run everything (dev)
- **Web:** `apps/web` → `bun run dev` (port 3001). Env in `apps/web/.env.local`.
- **Infra:** repo root → `docker compose up -d` (RabbitMQ + MinIO).
- **AI/media service:** `apps/ai` → `uv run uvicorn app.main:app --port 8001 --reload` **and** `uv run celery -A app.celery_app worker --pool=solo --loglevel=info`. Env in `apps/ai/.env`.
- **DB migrations:** `apps/web` → `bun run db:generate` then `bun run db:migrate`.
- **Git:** run from repo **root**. User runs all commands; branch per phase (`phase-<N>-<topic>`, whole phase on one branch).
