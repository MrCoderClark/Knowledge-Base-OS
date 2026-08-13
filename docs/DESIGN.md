---
name: Acme Knowledge Core
colors:
  surface: '#f9f9ff'
  surface-dim: '#cfdaf2'
  surface-bright: '#f9f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f0f3ff'
  surface-container: '#e7eeff'
  surface-container-high: '#dee8ff'
  surface-container-highest: '#d8e3fb'
  on-surface: '#111c2d'
  on-surface-variant: '#45464d'
  inverse-surface: '#263143'
  inverse-on-surface: '#ecf1ff'
  outline: '#76777d'
  outline-variant: '#c6c6cd'
  surface-tint: '#565e74'
  primary: '#000000'
  on-primary: '#ffffff'
  primary-container: '#131b2e'
  on-primary-container: '#7c839b'
  inverse-primary: '#bec6e0'
  secondary: '#4648d4'
  on-secondary: '#ffffff'
  secondary-container: '#6063ee'
  on-secondary-container: '#fffbff'
  tertiary: '#000000'
  on-tertiary: '#ffffff'
  tertiary-container: '#191c1e'
  on-tertiary-container: '#818486'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#dae2fd'
  primary-fixed-dim: '#bec6e0'
  on-primary-fixed: '#131b2e'
  on-primary-fixed-variant: '#3f465c'
  secondary-fixed: '#e1e0ff'
  secondary-fixed-dim: '#c0c1ff'
  on-secondary-fixed: '#07006c'
  on-secondary-fixed-variant: '#2f2ebe'
  tertiary-fixed: '#e0e3e5'
  tertiary-fixed-dim: '#c4c7c9'
  on-tertiary-fixed: '#191c1e'
  on-tertiary-fixed-variant: '#444749'
  background: '#f9f9ff'
  on-background: '#111c2d'
  surface-variant: '#d8e3fb'
typography:
  display-lg:
    fontFamily: Inter
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 56px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
    letterSpacing: '0'
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
    letterSpacing: '0'
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
    letterSpacing: '0'
  body-sm:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
    letterSpacing: '0'
  label-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
    letterSpacing: 0.02em
  label-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.05em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 4px
  xs: 8px
  sm: 12px
  md: 16px
  lg: 24px
  xl: 32px
  sidebar-width: 280px
  container-max: 1200px
  gutter: 24px
---

## Brand & Style
The design system is engineered for high-density information environments where clarity, speed, and precision are paramount. The brand personality is **authoritative yet understated**, prioritizing content over chrome. 

The aesthetic follows a **Modern Professional Minimalism** approach, heavily influenced by tool-first interfaces. It utilizes expansive whitespace, a restrained color palette, and a focus on functional aesthetics. The emotional response should be one of "calm productivity"—reducing cognitive load for enterprise users managing complex knowledge bases.

## Colors
The palette is anchored by **Deep Slate (#0F172A)** for primary branding and navigation elements, providing a grounded, institutional feel. **Indigo (#6366F1)** is reserved for high-intent actions, progress indicators, and active states.

- **Backgrounds:** Use `#F8FAFC` for the main application canvas to differentiate from white surface containers.
- **Surfaces:** Cards and content areas must use pure `#FFFFFF` to create a clear "layering" effect.
- **Borders:** Use `#E2E8F0` for all structural divisions. Avoid heavy shadows; rely on these soft borders for definition.
- **Typography:** Headings use `#1E293B` for maximum legibility. Body text uses `#475569` to soften the visual weight of long-form documentation.

## Typography
The system relies exclusively on **Inter** to maintain a systematic, utilitarian feel. 

- **Headings:** Utilize tighter letter-spacing (`-0.01em` to `-0.02em`) for larger sizes to maintain visual tension.
- **Body:** Standard body text is set at `16px` for optimal reading comfort in document-heavy views.
- **Labels:** Small labels and captions use a medium or semi-bold weight to ensure visibility despite their reduced size.
- **Tracking:** For UI labels in all-caps, apply a `0.05em` tracking to prevent characters from visually merging.

## Layout & Spacing
This design system uses a **Fixed-Sidebar Fluid-Content** model. 

- **Sidebar:** A persistent `280px` left-hand navigation allows for deep nesting of knowledge hierarchies.
- **Main Canvas:** Content sits within a centered container with a maximum width of `1200px` for readability, though dashboards may utilize full-width fluid layouts.
- **Grid:** Use a 12-column grid for dashboard views with `24px` gutters.
- **Vertical Rhythm:** Spacing between sections should default to `32px` (xl) to maintain the "premium" airy feel.

## Elevation & Depth
In this design system, depth is communicated through **Tonal Layering** rather than heavy shadows.

- **Level 0 (Background):** `#F8FAFC`.
- **Level 1 (Cards/Surfaces):** `#FFFFFF` with a `1px` solid border of `#E2E8F0`. 
- **Level 2 (Dropdowns/Modals):** `#FFFFFF` with a very soft, diffused shadow (`0px 10px 15px -3px rgba(0, 0, 0, 0.05)`).
- **Interactions:** Hover states on interactive cards should result in a subtle lift (border color change to `#CBD5E1`) rather than an increase in shadow depth.

## Shapes
The design system adopts a **"Soft Professional"** geometry.

- **Standard Elements:** Buttons, input fields, and small cards use a `8px` (0.5rem) radius.
- **Large Containers:** Content cards and modals use a `12px` (0.75rem) radius.
- **Selection States:** Hover highlights in lists or navigation menus should use a `6px` radius to sit comfortably within their parent containers.

## Components
- **Buttons:** Primary buttons use `#0F172A` with white text. Secondary buttons use a white fill with a `#E2E8F0` border. Actions are always `8px` rounded.
- **Inputs:** Use a `1px` border (`#E2E8F0`) and `16px` horizontal padding. Focus states transition the border to `#6366F1` with a `2px` soft indigo glow.
- **Cards:** White background, `1px` border, `24px` internal padding. Titles within cards should always use `headline-sm`.
- **Navigation:** Sidebar links use `#475569` text; the active state uses a subtle `#F1F5F9` background and `#0F172A` text with a vertical Indigo indicator line.
- **Chips/Badges:** Use a soft background (10% opacity of the status color) with a bold text label in the same hue.
- **Iconography:** Use a consistent 2px stroke-weight line icon set. Icons should be sized to `20px` for standard UI actions and `24px` for section headers.