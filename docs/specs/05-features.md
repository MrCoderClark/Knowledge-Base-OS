# Spec 05 — Features (module by module)

Status: Draft · Phase: 1 · Owner: TBD

Functional specs per sidebar module, matching the `Dashboard.png` reference. Each
module lists behavior + acceptance criteria. All views live inside the app shell
(fixed 280px sidebar, top command-K bar, content canvas) per [`06-design-system.md`](./06-design-system.md).

---

## Dashboard
The landing view ("Good morning, {name}").

- **Quick actions row:** Upload Document, Upload Video, Create Collection, Add Category
  (cards, indigo icon, open the relevant create flow).
- **KPI stat cards:** Total Knowledge Items, Documents (+ added this week), Videos
  (+ new), Active Users (+ % this month). Numbers are org-scoped live counts; deltas
  computed vs. prior period. Trend arrow uses success/indigo hue.
- **Continue Learning:** the user's in-progress videos/collections from
  `learning_progress`, with thumbnail, module/section label, and a progress bar. "View
  All" → filtered library.
- **Recently Added:** table of latest content (Content, Type badge, Category, Date).
- **Recent Activity:** feed from `activity_events` (actor avatar, verb, target link,
  relative time; comment events show the excerpt).

**Acceptance:** all sections render from real org data; empty states designed; loads
p95 < 500 ms with seed data.

---

## Knowledge Base / Documents
- **List/library:** filter by category, type, status; sort by recent/title; grid or
  table. Pagination/infinite scroll.
- **Create — authored:** Tiptap block editor → stored as `documents.body` (jsonb),
  `doc_type = authored`. Draft/publish states.
- **Create — uploaded:** presigned PUT to Object Storage; store `file_key`, mime, size;
  `doc_type = uploaded`. Supported: PDF, Docx, Md, images.
- **Viewer:** authored docs render from Tiptap JSON; uploaded render inline (PDF/image)
  or offer download; metadata sidebar (category, author, version, updated).
- **Versioning:** each publish snapshots a `document_versions` row; view/restore prior
  versions with change notes.
- **Categorize & collect:** assign category; add to collections.

**Acceptance:** create both doc types; publish creates a version; viewer renders both;
RBAC gates create/update/delete/publish; every change logs activity.

---

## Videos
- **Upload:** presigned PUT; row `status = uploaded`. (Phase 1 plays the original file;
  Phase 2 adds HLS transcode, poster, transcript → `status` transitions.)
- **Player:** poster + native/HLS player; resumes from `learning_progress.last_position`.
- **Progress tracking:** playback updates `learning_progress.progress_pct` (feeds
  Continue Learning).
- **Metadata:** title, category, duration, description.

**Acceptance:** upload + play works P1; progress persists and drives dashboard;
Phase-2 processing fields exist but are optional/nullable.

---

## Categories
- Nested CRUD (self-referencing `parent_id`), per-org unique slug, optional color used
  by badges/chips.
- Reassign content in bulk; deleting a category reparents or unsets children (confirm).

**Acceptance:** create nested categories; color drives badge hue; content counts show.

---

## Collections
- Curated, ordered groupings across documents **and** videos (e.g. "Engineering
  Onboarding 2024"), with cover image and visibility (org/team/private).
- Reorder items (`collection_items.position`); collections can track completion and feed
  Continue Learning.

**Acceptance:** create a collection, add mixed items, reorder, set visibility; private/
team visibility enforced by RBAC.

---

## Search
Global command-K + a full search results page. See [`04-search.md`](./04-search.md).

**Acceptance:** command-K opens anywhere; grouped, permission-scoped results; results
page supports filters (type/category) and pagination.

---

## Users
- Org member directory: avatar, name, email, org role, teams, status, last active.
- Invite by email; change role; suspend/remove. See [`03-auth-rbac.md`](./03-auth-rbac.md).
- **Account status & lock management:** show each user's status — `active`,
  `invited`, `suspended`, and **`locked`** (derived from `locked_until > now`). A locked
  row shows a badge + when it auto-expires.
- **Admin unlock action:** an admin can unlock a locked account immediately. Unlock
  **must clear both stores**: reset `locked_until = null` + `failed_login_attempts = 0`
  in Postgres **and** delete the user's Redis login limiter keys (`rl_login_acct:*` for
  that account) — otherwise Redis keeps throttling. Log `ACCOUNT_UNLOCKED`.

**Acceptance:** invite flow works end to end; role changes take effect immediately;
only `admin`/`owner` can manage members; locked accounts are visibly flagged and an
admin unlock lets the user sign in right away (DB **and** Redis cleared).

---

## Teams
- CRUD teams; add/remove members; set team role (lead/member).
- Team-scoped content visibility for collections/documents marked `team`.

**Acceptance:** create team, manage membership, team visibility restricts access.

---

## Analytics
- Org-level metrics: content growth, most-viewed docs/videos, active users, search
  terms, learning completion rates. Sourced from `activity_events` + `learning_progress`.
- Date-range filter; charts follow the design system (indigo accents, soft borders).

**Acceptance:** at least content-growth, top-content, and active-users views render;
`analytics:read` gated.

---

## Activity
- Full, filterable audit/activity stream (by actor, verb, target type, date).

**Acceptance:** paginated feed; filters work; `activity:read` gated.

---

## Settings
- Org profile (name, slug, logo), branding, default visibility, integrations
  placeholders. `settings:manage` gated.

**Acceptance:** owner/admin can edit org profile; changes persist and audit.

---

## Permissions
- Member role management + read-only role→permission matrix (Phase 3: custom roles).

**Acceptance:** matches [`03-auth-rbac.md`](./03-auth-rbac.md); `permissions:manage` gated.

---

## Cross-cutting acceptance

- [ ] Every mutating action checks a permission and writes an activity event.
- [ ] Every list/detail view is org-scoped and respects visibility/team rules.
- [ ] Empty, loading, and error states are designed for every module.
- [ ] All surfaces use the design-system components and tokens.
