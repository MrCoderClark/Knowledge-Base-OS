# Spec 06 — Design System Implementation

Status: Draft · Phase: 0 · Owner: TBD

Translates [`DESIGN.md`](../DESIGN.md) (the source of truth for visual language) into a
concrete Tailwind v4 theme and component contracts. When this spec and `DESIGN.md`
disagree, `DESIGN.md` wins.

## 1. Foundations (from DESIGN.md)

- **Font:** Inter, everywhere. Load via `next/font` (self-hosted, no CDN).
- **Aesthetic:** "Modern Professional Minimalism" — content over chrome, tonal layering
  over heavy shadows, soft borders for definition.
- **Canvas vs. surface:** app background `#F8FAFC`; cards/surfaces pure `#FFFFFF` with a
  `1px` `#E2E8F0` border (Level 1). Dropdowns/modals get the soft diffused shadow
  `0 10px 15px -3px rgba(0,0,0,0.05)` (Level 2).
- **Primary/brand:** Deep Slate `#0F172A` (nav, primary buttons). **Indigo `#6366F1`**
  for high-intent actions, active states, progress, focus glow.

## 2. Tailwind v4 theme (`@theme`)

Define tokens in `src/styles/theme.css` via Tailwind v4 CSS-first `@theme`. Map the
`DESIGN.md` values:

```css
@theme {
  /* color roles */
  --color-canvas: #F8FAFC;          /* background */
  --color-surface: #FFFFFF;         /* cards */
  --color-border: #E2E8F0;          /* structural divisions */
  --color-border-strong: #CBD5E1;   /* hover lift */
  --color-slate: #0F172A;           /* primary / brand */
  --color-indigo: #6366F1;          /* accent / active / focus */
  --color-heading: #1E293B;
  --color-body: #475569;
  --color-nav-active-bg: #F1F5F9;

  /* radii */
  --radius-sm: 0.375rem;  /* 6px selection states */
  --radius: 0.5rem;       /* 8px buttons/inputs/small cards */
  --radius-lg: 0.75rem;   /* 12px content cards/modals */

  /* spacing scale (4px base) */
  --spacing-xs: 8px; --spacing-sm: 12px; --spacing-md: 16px;
  --spacing-lg: 24px; --spacing-xl: 32px;

  /* layout */
  --sidebar-width: 280px;
  --container-max: 1200px;
  --gutter: 24px;

  /* type scale — Inter, tight tracking on large headings */
  --text-display-lg: 48px; --text-headline-lg: 32px; --text-headline-md: 24px;
  --text-headline-sm: 20px; --text-body-lg: 18px; --text-body-md: 16px;
  --text-body-sm: 14px; --text-label-md: 14px; --text-label-sm: 12px;
}
```

> The full palette (Material-style role tokens) is enumerated in `DESIGN.md`
> frontmatter; import all of it. The subset above is the working set most components use.

## 3. Layout shell

- **Fixed sidebar:** `280px`, full height, Level-1 styling, holds the primary nav
  (Dashboard, Knowledge Base, Documents, Videos, Categories, Collections, Search, Users,
  Teams, Analytics, Activity) and a footer group (Settings, Permissions). Prominent
  **"+ New Document"** slate button pinned at top.
- **Top bar:** global command-K search input (`⌘K` hint chip), Help, notifications,
  avatar menu.
- **Content canvas:** centered `max-width: 1200px` for reading views; dashboards may go
  full-width fluid with a 12-column grid, `24px` gutters. Section vertical rhythm `32px`.

## 4. Component contracts

| Component | Spec |
|---|---|
| **Button — primary** | `#0F172A` fill, white text, `8px` radius, `label-md`. |
| **Button — secondary** | white fill, `1px #E2E8F0` border, `8px` radius. |
| **Input** | `1px #E2E8F0` border, `16px` h-padding; focus → `#6366F1` border + `2px` soft indigo glow. |
| **Card** | white, `1px #E2E8F0` border, `24px` padding, `12px` radius; title = `headline-sm`. Hover (interactive) → border `#CBD5E1` (lift, no shadow bump). |
| **Nav link** | text `#475569`; active → `#F1F5F9` bg, `#0F172A` text, left indigo indicator line, `6px` radius. |
| **Stat card** | label (`label-md`, muted) + big value (`headline-lg`) + trend chip (success/indigo). |
| **Chip / Badge** | soft bg (10% of status hue) + bold same-hue label. Category badges use `categories.color`. |
| **Progress bar** | indigo fill on light track; used in Continue Learning. |
| **Dropdown / Modal** | white, `12px` radius, Level-2 soft shadow. |
| **Icons** | `lucide-react`, 2px stroke; `20px` UI / `24px` section headers. |
| **Command palette** | `cmdk`, grouped results, keyboard nav (see `04-search.md`). |

Interactive primitives (menus, dialogs, tabs, tooltips, popovers) use **Radix** headless
components styled with the tokens above — accessible by default.

## 5. Conventions

- Depth via **tonal layering + borders**, not shadows (except Level-2 overlays).
- Consistent radii: 6/8/12 as specified — never mix arbitrary values.
- All-caps UI labels get `0.05em` tracking (`label-sm`).
- Respect `prefers-reduced-motion`; hover transitions are subtle (border/opacity).
- Everything keyboard-accessible; visible focus states everywhere (indigo glow).

## Acceptance criteria

- [ ] Tailwind theme reproduces `DESIGN.md` tokens; no hard-coded hex in components.
- [ ] App shell matches `Dashboard.png` (sidebar, command-K bar, canvas).
- [ ] Button/Input/Card/Nav/Stat/Badge/Progress components exist and match contracts.
- [ ] Inter self-hosted; icons are 2px-stroke lucide at 20/24px.
- [ ] Focus, hover, empty, and loading states implemented per spec.
