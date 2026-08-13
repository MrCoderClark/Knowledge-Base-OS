# KnowledgeOS — Working Agreement

Project context, plan, and specs live in [`docs/`](./docs):
[`PLAN.md`](./docs/PLAN.md) · [`specs/`](./docs/specs) · [`DESIGN.md`](./docs/DESIGN.md) (visual source of truth) · `Dashboard.png` (reference).

## Workflow rules (read first)

1. **Package manager: `bun`, not npm.** Use `bun install`, `bun add`, `bun run <script>`,
   `bunx`. Do not use `npm`/`npx`/`yarn`/`pnpm`. The web app lives in `apps/web`.
2. **The user runs all commands.** Do **not** execute install/build/dev/migration/git
   commands yourself. Instead, **present the exact command(s)** for the user to run and
   wait for their output before continuing.
3. **Git: branch + commit per phase.**
   - Start each phase on a **new branch** (e.g. `phase-0-foundations`, `phase-1-core-kb`).
   - **Commit after every phase** once it's complete and verified.
   - The user runs the git commands; Claude provides the branch name, commit message, and
     the commands.
4. Commit messages end with the standard co-author trailer:
   `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`

## Stack (decided — see PLAN.md)

- **Next.js 16 (App Router) + TypeScript + Tailwind v4**, Inter font.
- **Drizzle ORM + Neon Postgres**; **Neon Object Storage** for files/videos.
- **Auth.js (NextAuth) + custom RBAC** (org → team → role → permission).
- **Search:** Postgres FTS + `pg_trgm` behind a `SearchProvider` interface → pgvector
  hybrid in Phase 2.
- **Python (FastAPI) service is Phase 2 only** (AI RAG chatbot + video processing).
- Documents: **Tiptap** for authored docs + native render for uploaded files.

## Next.js 16 caveat

This is **Next.js 16**, which differs from older training data. Before writing Next code,
read the relevant guide in `apps/web/node_modules/next/dist/docs/` (see
`apps/web/AGENTS.md`). Known differences: `params`/`searchParams` are **Promises** (await
them); `PageProps<'/route'>` / `LayoutProps<'/route'>` are **global** typed helpers.

## Phase checklist (from PLAN.md)

- **Phase 0 — Foundations:** scaffold, design tokens, app shell, Neon+Drizzle, Auth.js.
- **Phase 1 — Core KB:** data model, RBAC, documents, videos, categories, collections,
  search, dashboard, users, teams, analytics, activity, settings, permissions.
- **Phase 2 — AI & rich media:** Python service, video processing, embeddings, hybrid
  search, RAG chatbot.
- **Phase 3 — Enterprise hardening:** SSO/SAML/SCIM, audit, retention, workflows.
