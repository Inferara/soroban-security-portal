# Stellar Security Portal — Cosmic Depth 2026 Redesign

**Date:** 2026-05-27
**Branch:** `feature/stellar-security-redesign` (from `origin/main`)
**Type:** Light visual + interaction redesign of the UI. No backend logic, routing, auth, or data-model changes.

## Goal

Refresh the portal into a modern, interactive "2026" look while keeping the existing
brand colors, logo, layout of main elements, and **all functionality**. Rename the product
from "SOROBAN SECURITY PORTAL" to **"Stellar Security Portal"** in all user-facing UI.

This is a presentation-layer change. It must not conflict with or duplicate functionality
already on `main`, must not introduce security issues, must be a complete (non-mock) solution,
and must not touch CI/CD.

## Decisions (from brainstorming)

1. **Base branch:** new branch from `origin/main`.
2. **Scope:** global theme + key public pages (header/footer, home/hero, lists, detail pages,
   cards, buttons, micro-interactions). Admin pages inherit the theme automatically; no manual
   admin polish.
3. **Theme toggle:** enable the currently-hidden light/dark toggle; polish **both** themes.
4. **Design direction:** **C · Cosmic Depth** — deep-space neon for dark mode.
5. **Light mode:** **Full Daylight** — dawn-sky gradient (pale blue → warm gold), dark text,
   faint constellation lines instead of glowing starfield; hero is light too.
6. **Motion:** restrained/tasteful; full `prefers-reduced-motion` support.
7. **Rename scope:** all user-facing UI strings (`document.title`, `index.html`, `SeoHead`/OG
   meta, hero, about, login, roles-info). Internal names (package, Docker, configs) untouched.

## Design Language & Tokens

### Palette (unchanged brand colors, formalized into the theme)
- Gold `#FFD84D` / muted gold `#DDCDB1`; brand blue `#2D4EFF` / hover `#1a3fd9`; dark `#1e1e1e`.
- **Dark = Cosmic Depth:** background deep space `#07070d`→`#0f0f17` with a faint radial glow,
  neon gold/blue glow on accents and borders, subtle star dust.
- **Light = Full Daylight:** dawn-sky gradient (pale blue → warm gold), dark text, thin
  constellation lines; hero light.
- Severity colors (`SeverityColors` and variants in `ThemeContext.tsx`) remain unchanged.

### Typography
- Keep Roboto/Rubik. Establish a scale: large "editorial" headings in hero/section titles,
  tuned `letter-spacing`; optional monospace accents for technical labels (severity, IDs).

### Motion (restrained, reduced-motion aware)
- A single `useReducedMotion` hook is the source of truth. When reduce is requested, all
  animations are disabled and the galaxy is static.
- Micro-interactions: hover-lift + glow on buttons/cards, smooth transitions, focus-glow for
  accessibility, scroll-reveal of home sections via `IntersectionObserver`.
- `GalaxyCanvas` enhancement: subtle star dust + fade-in, **fix the `requestAnimationFrame`
  leak** (no `cancelAnimationFrame` on unmount today), freeze when reduced-motion, dim/recolor
  for the light theme.

## What Changes by Area (layout and functionality unchanged)

| Area | Changes |
|---|---|
| **Header** (`main-window.tsx`) | "Stellar Security Portal" brand text beside logo; nav buttons with glow underline for the active item; **restore the theme toggle** (remove `visibility:hidden`); themed AppBar surface |
| **Hero (home)** | Title → "WELCOME TO THE / STELLAR SECURITY PORTAL"; CTA buttons (Warp/Learn More) with neon glow; enhanced galaxy; scroll-reveal of statistics/roles/chart |
| **Cards / sections** | Statistics, RolesInfo, PieChart, Reports/Vulnerabilities lists, detail pages — unified "cosmic surface": hairline border, hover-glow, radius, shadow |
| **Lists & detail** | Same data/tables; restyled cards and headings; severity chips with neon accent |
| **Footer** | Same content; social icons with hover-glow |
| **Buttons / inputs / chips** | Restyled globally via `theme.components` overrides; admin inherits automatically |
| **Rename** | All user-facing strings; internal names untouched |

## Architecture & Approach

- **Theme is the center of gravity.** Rewrite `ThemeContext.tsx`: complete `lightTheme`/
  `darkTheme` with palette + `components` overrides (Button, Card, Paper, Chip, TextField,
  AppBar, Drawer, Link, Tooltip). Most MUI components restyle automatically, so admin and other
  pages get the theme "for free" without editing all ~188 hardcoded hex values.
- **Targeted refactor** only of key public surfaces (header, home + its sections, lists, detail,
  footer): replace hardcoded hex with theme tokens where it affects consistency. Leave deep
  admin hardcodes unless they clash.
- **New small reusable units:**
  - `theme/tokens.ts` — extend `constants.ts` with semantic Cosmic/Daylight tokens.
  - `hooks/useReducedMotion.ts` — single source of truth for motion.
  - `components/common/CosmicSurface.tsx` (or an `sx` helper) — surface with glow + hairline.
  - `components/common/RevealOnScroll.tsx` — scroll-reveal wrapper.
- **No new heavy dependencies** (three.js already present; motion via CSS + IntersectionObserver,
  no framer-motion).

## Safety / Non-Conflict / Completeness

- **Non-conflict with main:** branch from `origin/main`; purely presentational changes
  (CSS/theme/strings); no edits to API, models, routing, auth, moderation, or comments logic.
  No duplicated features.
- **Security:** no `dangerouslySetInnerHTML`; rename touches strings only; no new network calls;
  severity/category handling and content filtering unchanged. SeoHead/OG kept server-side;
  only the product-name string changes (preserve crawler behavior).
- **Completeness (not a mock):** both themes work, toggle works, reduced-motion works, responsive.

## Testing & Deploy Plan

- Unit tests for `ThemeContext`/`useReducedMotion` (vitest, local, not pushed as PR).
- `npm run build` + lint must pass.
- Manual image build + push to Docker Hub `andreykerchin/soroban-security-portal*:issuesXX`,
  then `helm upgrade` to the dev cluster (kubeconfig.temp). **No CI/CD pipelines triggered.**
- **Playwright non-headless** walkthrough: home / lists / detail / login, theme toggle,
  reduced-motion, rename verification, OG meta check; capture screenshots.
- API checks if needed.

## Out of Scope

- Backend changes, email templates (UI-only rename was chosen).
- Manual polish of admin dashboards/tables/forms (they inherit the theme only).
- New features, routing changes, dependency upgrades beyond what the redesign needs.
- Logo redesign (logo is a text-free mark, kept as-is).
