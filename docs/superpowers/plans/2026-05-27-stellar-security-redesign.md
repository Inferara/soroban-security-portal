# Stellar Security Portal — Cosmic Depth Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refresh the portal into a modern, interactive "Cosmic Depth" 2026 look (rename to "Stellar Security Portal", enable light/dark, restrained motion) while keeping brand colors, logo, layout, and all functionality.

**Architecture:** The MUI theme is the center of gravity — a rewritten `ThemeContext` (palette + component overrides + cosmic/daylight tokens) restyles most components automatically. A small set of new units (`tokens`, `useReducedMotion`, `CosmicSurface`, `RevealOnScroll`) provide the cosmic surfaces and motion. Key public surfaces (header, home, footer, lists, detail, login) are then refactored onto those tokens. Purely presentational — no API/routing/auth/data changes.

**Tech Stack:** React 19, MUI 9, Vite, three.js (already present), vitest + React Testing Library, Playwright (e2e). No new dependencies.

**Working directory note:** All paths below are relative to `UI/`. Run all `npm`/`npx` commands from `UI/`.

---

## File Structure

**New files:**
- `UI/src/theme/tokens.ts` — Cosmic (dark) and Daylight (light) semantic tokens (gradients, glows, surfaces).
- `UI/src/hooks/useReducedMotion.ts` — single source of truth for `prefers-reduced-motion`.
- `UI/src/components/common/CosmicSurface.tsx` — themed surface (border + glow + hover).
- `UI/src/components/common/RevealOnScroll.tsx` — IntersectionObserver fade-up wrapper.
- Test files alongside each (`__tests__` dirs).

**Modified files:**
- `UI/src/contexts/ThemeContext.tsx` — rewrite palette + component overrides + expose `tokens`/`themeMode`.
- `UI/src/main.tsx` — rename `document.title`.
- `UI/index.html` — rename `<title>`.
- `UI/src/components/common/SeoHead.tsx` — rename title template / og:site_name / default description.
- `UI/src/components/common/ShareButtons.tsx` — rename share text.
- `UI/src/features/authentication/authentication.tsx` — rename + restyle login.
- `UI/src/features/pages/regular/home/home.tsx` — hero rename + restyle + reveal.
- `UI/src/features/pages/regular/home/galaxy-canvas.tsx` — enhance + fix rAF leak + reduced-motion/light.
- `UI/src/features/pages/regular/home/roles-info.tsx` — rename + surface restyle.
- `UI/src/features/pages/regular/about/about.tsx` — rename (product name only).
- `UI/src/features/pages/regular/main-window/main-window.tsx` — header brand text, nav glow, restore theme toggle, footer polish.
- List/detail pages: `reports`, `vulnerabilities`, `*-details` — apply `CosmicSurface`/tokens to cards & headings.

---

## Task 1: Cosmic/Daylight theme tokens

**Files:**
- Create: `UI/src/theme/tokens.ts`
- Test: `UI/src/theme/__tests__/tokens.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// UI/src/theme/__tests__/tokens.test.ts
import { describe, it, expect } from 'vitest';
import { CosmicTokens, DaylightTokens, getThemeTokens } from '../tokens';

describe('theme tokens', () => {
  it('exposes cosmic + daylight token sets with the same keys', () => {
    expect(Object.keys(CosmicTokens).sort()).toEqual(Object.keys(DaylightTokens).sort());
  });
  it('returns cosmic tokens for dark and daylight for light', () => {
    expect(getThemeTokens('dark')).toBe(CosmicTokens);
    expect(getThemeTokens('light')).toBe(DaylightTokens);
  });
  it('keeps brand accent colors', () => {
    expect(CosmicTokens.accentGold).toBe('#FFD84D');
    expect(CosmicTokens.accentBlue).toBe('#2D4EFF');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/theme/__tests__/tokens.test.ts`
Expected: FAIL — cannot find module `../tokens`.

- [ ] **Step 3: Write the implementation**

```ts
// UI/src/theme/tokens.ts
/**
 * Cosmic Depth (dark) and Full Daylight (light) semantic tokens.
 * Brand colors are unchanged; these tokens describe how the redesign uses them
 * (gradients, glows, surfaces) per theme mode. Standard colors stay in the MUI
 * palette (ThemeContext); these are the redesign-specific extras.
 */
export interface ThemeTokens {
  accentGold: string;
  accentBlue: string;
  /** Page/hero background (full-bleed). */
  heroBackground: string;
  /** Elevated card/surface background. */
  surface: string;
  /** Hairline border for surfaces. */
  surfaceBorder: string;
  /** Box-shadow for resting surfaces. */
  surfaceShadow: string;
  /** Box-shadow for hovered/elevated surfaces (glow). */
  surfaceShadowHover: string;
  /** Gold glow used on accents/text. */
  glowGold: string;
  /** Blue glow used on CTAs/borders. */
  glowBlue: string;
  /** Subtle section background gradient. */
  sectionGradient: string;
  /** three.js galaxy inside color. */
  galaxyInside: string;
  /** three.js galaxy outside color. */
  galaxyOutside: string;
  /** Overall galaxy opacity (dimmed in light mode). */
  galaxyOpacity: number;
}

export const CosmicTokens: ThemeTokens = {
  accentGold: '#FFD84D',
  accentBlue: '#2D4EFF',
  heroBackground:
    'radial-gradient(120% 100% at 50% 120%, rgba(45,78,255,0.35) 0%, transparent 60%), ' +
    'radial-gradient(90% 70% at 85% 0%, rgba(255,216,77,0.18) 0%, transparent 55%), ' +
    '#07070d',
  surface: 'rgba(255,255,255,0.03)',
  surfaceBorder: 'rgba(255,255,255,0.10)',
  surfaceShadow: '0 2px 18px rgba(0,0,0,0.45)',
  surfaceShadowHover:
    '0 0 0 1px rgba(255,216,77,0.35), 0 8px 32px rgba(45,78,255,0.30)',
  glowGold: '0 0 18px rgba(255,216,77,0.55)',
  glowBlue: '0 0 18px rgba(45,78,255,0.55)',
  sectionGradient:
    'linear-gradient(180deg, rgba(45,78,255,0.06) 0%, transparent 100%)',
  galaxyInside: '#ffb700',
  galaxyOutside: '#646cff',
  galaxyOpacity: 1,
};

export const DaylightTokens: ThemeTokens = {
  accentGold: '#FFD84D',
  accentBlue: '#2D4EFF',
  heroBackground:
    'radial-gradient(110% 90% at 50% 110%, rgba(45,78,255,0.16) 0%, transparent 60%), ' +
    'radial-gradient(90% 70% at 80% 0%, rgba(255,216,77,0.28) 0%, transparent 55%), ' +
    'linear-gradient(180deg, #eef2ff 0%, #fff6e0 100%)',
  surface: '#ffffff',
  surfaceBorder: 'rgba(20,20,50,0.10)',
  surfaceShadow: '0 2px 14px rgba(20,30,80,0.08)',
  surfaceShadowHover:
    '0 0 0 1px rgba(45,78,255,0.25), 0 10px 28px rgba(45,78,255,0.15)',
  glowGold: '0 0 14px rgba(154,123,31,0.30)',
  glowBlue: '0 0 14px rgba(45,78,255,0.30)',
  sectionGradient:
    'linear-gradient(180deg, rgba(45,78,255,0.04) 0%, transparent 100%)',
  galaxyInside: '#c79200',
  galaxyOutside: '#2D4EFF',
  galaxyOpacity: 0.45,
};

export type ThemeModeName = 'light' | 'dark';

export const getThemeTokens = (mode: ThemeModeName): ThemeTokens =>
  mode === 'dark' ? CosmicTokens : DaylightTokens;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/theme/__tests__/tokens.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add UI/src/theme/tokens.ts UI/src/theme/__tests__/tokens.test.ts
git commit -m "feat(theme): add Cosmic/Daylight semantic tokens"
```

---

## Task 2: useReducedMotion hook

**Files:**
- Create: `UI/src/hooks/useReducedMotion.ts`
- Test: `UI/src/hooks/__tests__/useReducedMotion.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// UI/src/hooks/__tests__/useReducedMotion.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useReducedMotion } from '../useReducedMotion';

function mockMatchMedia(matches: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
    onchange: null,
  }));
}

describe('useReducedMotion', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('returns true when the user prefers reduced motion', () => {
    mockMatchMedia(true);
    const { result } = renderHook(() => useReducedMotion());
    expect(result.current).toBe(true);
  });

  it('returns false when reduced motion is not preferred', () => {
    mockMatchMedia(false);
    const { result } = renderHook(() => useReducedMotion());
    expect(result.current).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/hooks/__tests__/useReducedMotion.test.tsx`
Expected: FAIL — cannot find module `../useReducedMotion`.

- [ ] **Step 3: Write the implementation**

```ts
// UI/src/hooks/useReducedMotion.ts
import { useEffect, useState } from 'react';

const QUERY = '(prefers-reduced-motion: reduce)';

/**
 * Returns true when the user has requested reduced motion.
 * Single source of truth for gating animations across the redesign.
 */
export const useReducedMotion = (): boolean => {
  const [reduced, setReduced] = useState<boolean>(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia(QUERY).matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mql = window.matchMedia(QUERY);
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    setReduced(mql.matches);
    // Safari < 14 uses addListener
    if (mql.addEventListener) mql.addEventListener('change', onChange);
    else mql.addListener(onChange);
    return () => {
      if (mql.removeEventListener) mql.removeEventListener('change', onChange);
      else mql.removeListener(onChange);
    };
  }, []);

  return reduced;
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/hooks/__tests__/useReducedMotion.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add UI/src/hooks/useReducedMotion.ts UI/src/hooks/__tests__/useReducedMotion.test.tsx
git commit -m "feat(hooks): add useReducedMotion"
```

---

## Task 3: Rewrite ThemeContext (palette + overrides + tokens)

**Files:**
- Modify: `UI/src/contexts/ThemeContext.tsx`
- Test: `UI/src/contexts/__tests__/ThemeContext.test.tsx` (extend existing)

**Context:** `ThemeContextType` currently exposes `{ themeMode, toggleTheme, theme }`. We add `tokens` (from Task 1). We keep `SeverityColors*` exports unchanged. Default mode stays `'dark'`. Buttons stop hardcoding bg and use `primary`. `primary.main` becomes the brand blue in both modes; `secondary` becomes gold.

- [ ] **Step 1: Write the failing test** (append to existing test file)

```tsx
// add to UI/src/contexts/__tests__/ThemeContext.test.tsx
import { renderHook } from '@testing-library/react';
import { ThemeProvider, useTheme } from '../ThemeContext';
import { CosmicTokens } from '../../theme/tokens';

it('exposes cosmic tokens in dark mode by default', () => {
  localStorage.setItem('themeMode', 'dark');
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <ThemeProvider>{children}</ThemeProvider>
  );
  const { result } = renderHook(() => useTheme(), { wrapper });
  expect(result.current.themeMode).toBe('dark');
  expect(result.current.tokens).toBe(CosmicTokens);
  expect(result.current.theme.palette.primary.main).toBe('#2D4EFF');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/contexts/__tests__/ThemeContext.test.tsx`
Expected: FAIL — `tokens` is undefined / `primary.main` mismatch.

- [ ] **Step 3: Implement — rewrite `ThemeContext.tsx`**

Replace the file contents above the `SeverityColors` block (keep all `SeverityColors*` exports and `useTheme` exactly as they are) with:

```tsx
import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { createTheme, Theme } from '@mui/material/styles';
import { CosmicTokens, DaylightTokens, ThemeTokens } from '../theme/tokens';

type ThemeMode = 'light' | 'dark';

interface ThemeContextType {
  themeMode: ThemeMode;
  toggleTheme: () => void;
  theme: Theme;
  tokens: ThemeTokens;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const fontFamily = ['Roboto', 'Rubik', 'Helvetica', 'Arial', 'sans-serif'].join(',');

const sharedTypography = {
  fontFamily,
  h1: { fontWeight: 800, letterSpacing: '-0.02em' },
  h2: { fontWeight: 800, letterSpacing: '-0.01em' },
  h3: { fontWeight: 700, letterSpacing: '-0.01em' },
  h4: { fontWeight: 700 },
  button: { fontWeight: 700, textTransform: 'none' as const },
};

const lightTheme = createTheme({
  typography: sharedTypography,
  shape: { borderRadius: 12 },
  palette: {
    mode: 'light',
    primary: { main: '#2D4EFF', dark: '#1a3fd9', contrastText: '#ffffff' },
    secondary: { main: '#9a7b1f', contrastText: '#ffffff' },
    text: { primary: '#15151f', secondary: '#4a4a5e' },
    background: { paper: '#ffffff', default: '#eef2ff' },
    divider: 'rgba(20,20,50,0.10)',
  },
  components: {
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: 'rgba(255,255,255,0.85)',
          backdropFilter: 'blur(10px)',
          color: '#15151f',
          boxShadow: 'none',
          borderBottom: '1px solid rgba(20,20,50,0.10)',
          backgroundImage: 'none',
        },
      },
    },
    MuiDrawer: {
      styleOverrides: { paper: { backgroundColor: '#ffffff', borderRight: '1px solid rgba(20,20,50,0.10)' } },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 10,
          transition: 'transform .2s ease, box-shadow .2s ease',
        },
        containedPrimary: {
          '&:hover': { boxShadow: '0 6px 20px rgba(45,78,255,0.35)', transform: 'translateY(-1px)' },
        },
      },
    },
    MuiPaper: { styleOverrides: { root: { backgroundImage: 'none' } } },
  },
});

const darkTheme = createTheme({
  typography: sharedTypography,
  shape: { borderRadius: 12 },
  palette: {
    mode: 'dark',
    primary: { main: '#2D4EFF', dark: '#1a3fd9', contrastText: '#ffffff' },
    secondary: { main: '#FFD84D', contrastText: '#0b0b14' },
    text: { primary: '#F2F2F2', secondary: '#b9c0d4' },
    background: { paper: '#13131c', default: '#0b0b14' },
    divider: 'rgba(255,255,255,0.10)',
  },
  components: {
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: 'rgba(11,11,20,0.72)',
          backdropFilter: 'blur(12px)',
          color: '#F2F2F2',
          boxShadow: 'none',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          backgroundImage: 'none',
        },
      },
    },
    MuiDrawer: {
      styleOverrides: { paper: { backgroundColor: '#13131c', borderRight: '1px solid rgba(255,255,255,0.08)' } },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 10,
          transition: 'transform .2s ease, box-shadow .2s ease',
        },
        containedPrimary: {
          '&:hover': { boxShadow: '0 0 20px rgba(45,78,255,0.55)', transform: 'translateY(-1px)' },
        },
      },
    },
    MuiPaper: { styleOverrides: { root: { backgroundImage: 'none' } } },
  },
});

export const ThemeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => {
    const savedTheme = localStorage.getItem('themeMode');
    return (savedTheme as ThemeMode) || 'dark';
  });

  const theme = themeMode === 'light' ? lightTheme : darkTheme;
  const tokens = themeMode === 'dark' ? CosmicTokens : DaylightTokens;

  const toggleTheme = () => {
    setThemeMode((prevMode) => {
      const newMode = prevMode === 'light' ? 'dark' : 'light';
      localStorage.setItem('themeMode', newMode);
      return newMode;
    });
  };

  useEffect(() => {
    localStorage.setItem('themeMode', themeMode);
    const root = document.documentElement;
    if (themeMode === 'dark') {
      root.style.setProperty('--highlight-bg', '#1a1a1a');
      root.style.setProperty('--highlight-border', '#90caf9');
    } else {
      root.style.setProperty('--highlight-bg', '#f0f8ff');
      root.style.setProperty('--highlight-border', '#1976d2');
    }
  }, [themeMode]);

  return (
    <ThemeContext.Provider value={{ themeMode, toggleTheme, theme, tokens }}>
      {children}
    </ThemeContext.Provider>
  );
};
```

Keep everything from the `SeverityColors` block downward (including `useTheme`) unchanged.

- [ ] **Step 4: Run the theme tests**

Run: `npx vitest run src/contexts/__tests__/ThemeContext.test.tsx`
Expected: PASS. If an existing assertion checked the old `primary.main` (`#F2F2F2`) or AppBar bg `#1e1e1e`/`#F2F2F2`, update that assertion to the new values (`#2D4EFF`, themed AppBar) — these are intentional redesign changes.

- [ ] **Step 5: Commit**

```bash
git add UI/src/contexts/ThemeContext.tsx UI/src/contexts/__tests__/ThemeContext.test.tsx
git commit -m "feat(theme): rewrite ThemeContext with cosmic/daylight palettes + tokens"
```

---

## Task 4: Rename to "Stellar Security Portal" (user-facing only)

**Files (modify):**
- `UI/index.html:7`
- `UI/src/main.tsx:69`
- `UI/src/components/common/SeoHead.tsx:25,31,39`
- `UI/src/components/common/ShareButtons.tsx:18`
- `UI/src/features/authentication/authentication.tsx:366`
- `UI/src/features/pages/regular/home/home.tsx:87`
- `UI/src/features/pages/regular/home/roles-info.tsx:109`
- `UI/src/features/pages/regular/about/about.tsx:41,105` (line 48: rename only "The Soroban Security Portal" → "The Stellar Security Portal"; keep "Soroban's" tech references)
- `UI/src/features/pages/admin/left-menu/admin-left-menu.tsx:122` (alt text)
- Test: `UI/src/__tests__/rename.test.tsx`

**Rule:** Replace the product name **"Soroban Security Portal" → "Stellar Security Portal"** and the hero **"SOROBAN SECURITY PORTAL" → "STELLAR SECURITY PORTAL"**. Do NOT change "Soroban" where it refers to the smart-contract platform (e.g., "Soroban's capabilities", "world of Soroban").

- [ ] **Step 1: Write the failing test**

```tsx
// UI/src/__tests__/rename.test.tsx
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const read = (p: string) => readFileSync(resolve(__dirname, '..', '..', p), 'utf8');

describe('product rename to Stellar Security Portal', () => {
  it('hero shows STELLAR SECURITY PORTAL', () => {
    expect(read('src/features/pages/regular/home/home.tsx')).toContain('STELLAR SECURITY PORTAL');
    expect(read('src/features/pages/regular/home/home.tsx')).not.toContain('SOROBAN SECURITY PORTAL');
  });
  it('SeoHead uses the new product name', () => {
    const seo = read('src/components/common/SeoHead.tsx');
    expect(seo).toContain('Stellar Security Portal');
    expect(seo).not.toContain('Soroban Security Portal');
  });
  it('document.title is renamed', () => {
    expect(read('src/main.tsx')).toContain('document.title = "Stellar Security Portal"');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/__tests__/rename.test.tsx`
Expected: FAIL — old strings still present.

- [ ] **Step 3: Apply the renames**

- `index.html`: `<title>Stellar Security Portal</title>`
- `main.tsx:69`: `document.title = "Stellar Security Portal";`
- `SeoHead.tsx`: default description `'Stellar security portal - audits, reports, and vulnerabilities.'`; title template `` `${title} | Stellar Security Portal` ``; `og:site_name` → `Stellar Security Portal`.
- `ShareButtons.tsx:18`: `` `Check out "${title}" on Stellar Security Portal` ``
- `authentication.tsx:366`: `alt="Stellar Security Portal"`
- `home.tsx:87`: `WELCOME TO THE<br />STELLAR SECURITY PORTAL`
- `roles-info.tsx:109`: `Thank you for contributing to the Stellar Security Portal!`
- `about.tsx:41`: `Welcome to The Stellar Security Portal`
- `about.tsx:48`: change only `The Soroban Security Portal is dedicated` → `The Stellar Security Portal is dedicated` (leave "Soroban's capabilities" and "Deployed on Stellar's ... Soroban brings" untouched)
- `about.tsx:105`: link text `text="Stellar Security Portal"`
- `admin-left-menu.tsx:122`: `alt="Stellar Security Portal"`

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/__tests__/rename.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Verify no stray user-facing occurrences remain**

Run (from repo root): `grep -rn "Soroban Security Portal\|SOROBAN SECURITY PORTAL" UI/src UI/index.html`
Expected: only code comments remain (`theme/constants.ts` header, `badge.ts` header) — those are non-user-facing. Optionally update those comments too. No user-facing strings.

- [ ] **Step 6: Commit**

```bash
git add UI/index.html UI/src
git commit -m "feat(rename): Soroban Security Portal -> Stellar Security Portal (user-facing)"
```

---

## Task 5: CosmicSurface + RevealOnScroll components

**Files:**
- Create: `UI/src/components/common/CosmicSurface.tsx`
- Create: `UI/src/components/common/RevealOnScroll.tsx`
- Test: `UI/src/components/common/__tests__/CosmicSurface.test.tsx`
- Test: `UI/src/components/common/__tests__/RevealOnScroll.test.tsx`

- [ ] **Step 1: Write the failing tests**

```tsx
// UI/src/components/common/__tests__/CosmicSurface.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ThemeProvider } from '../../../contexts/ThemeContext';
import { CosmicSurface } from '../CosmicSurface';

describe('CosmicSurface', () => {
  it('renders children', () => {
    render(
      <ThemeProvider>
        <CosmicSurface><span>hello surface</span></CosmicSurface>
      </ThemeProvider>,
    );
    expect(screen.getByText('hello surface')).toBeInTheDocument();
  });
});
```

```tsx
// UI/src/components/common/__tests__/RevealOnScroll.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RevealOnScroll } from '../RevealOnScroll';

class IO { observe = vi.fn(); unobserve = vi.fn(); disconnect = vi.fn(); }

describe('RevealOnScroll', () => {
  it('renders children even before intersection', () => {
    // @ts-expect-error test stub
    window.IntersectionObserver = IO;
    render(<RevealOnScroll><p>revealed content</p></RevealOnScroll>);
    expect(screen.getByText('revealed content')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/components/common/__tests__/CosmicSurface.test.tsx src/components/common/__tests__/RevealOnScroll.test.tsx`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement CosmicSurface**

```tsx
// UI/src/components/common/CosmicSurface.tsx
import { FC, ReactNode } from 'react';
import Box from '@mui/material/Box';
import type { SxProps, Theme } from '@mui/material/styles';
import { useTheme } from '../../contexts/ThemeContext';

interface CosmicSurfaceProps {
  children: ReactNode;
  /** Enable hover lift + glow (default true). */
  interactive?: boolean;
  sx?: SxProps<Theme>;
}

/**
 * Themed surface for cards/sections: hairline border, soft shadow,
 * and (optional) hover glow. Reads cosmic/daylight tokens from ThemeContext.
 */
export const CosmicSurface: FC<CosmicSurfaceProps> = ({ children, interactive = true, sx }) => {
  const { tokens } = useTheme();
  return (
    <Box
      sx={{
        backgroundColor: tokens.surface,
        border: `1px solid ${tokens.surfaceBorder}`,
        borderRadius: 3,
        boxShadow: tokens.surfaceShadow,
        backdropFilter: 'blur(6px)',
        transition: 'transform .25s ease, box-shadow .25s ease',
        ...(interactive && {
          '&:hover': {
            transform: 'translateY(-3px)',
            boxShadow: tokens.surfaceShadowHover,
            '@media (prefers-reduced-motion: reduce)': { transform: 'none' },
          },
        }),
        ...sx,
      }}
    >
      {children}
    </Box>
  );
};
```

- [ ] **Step 4: Implement RevealOnScroll**

```tsx
// UI/src/components/common/RevealOnScroll.tsx
import { FC, ReactNode, useEffect, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import { useReducedMotion } from '../../hooks/useReducedMotion';

interface RevealOnScrollProps {
  children: ReactNode;
  /** Delay in ms before the reveal transition (for staggering). */
  delay?: number;
}

/**
 * Fades + slides content up when it scrolls into view. No-op (always visible)
 * when the user prefers reduced motion or IntersectionObserver is unavailable.
 */
export const RevealOnScroll: FC<RevealOnScrollProps> = ({ children, delay = 0 }) => {
  const reduced = useReducedMotion();
  const ref = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(reduced);

  useEffect(() => {
    if (reduced || typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return;
    }
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setVisible(true);
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [reduced]);

  return (
    <Box
      ref={ref}
      sx={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'none' : 'translateY(24px)',
        transition: reduced ? 'none' : `opacity .6s ease ${delay}ms, transform .6s ease ${delay}ms`,
        willChange: 'opacity, transform',
      }}
    >
      {children}
    </Box>
  );
};
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/components/common/__tests__/CosmicSurface.test.tsx src/components/common/__tests__/RevealOnScroll.test.tsx`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add UI/src/components/common/CosmicSurface.tsx UI/src/components/common/RevealOnScroll.tsx UI/src/components/common/__tests__
git commit -m "feat(ui): add CosmicSurface + RevealOnScroll components"
```

---

## Task 6: Enhance GalaxyCanvas (reduced-motion, light dimming, fix rAF leak)

**Files:**
- Modify: `UI/src/features/pages/regular/home/galaxy-canvas.tsx`

**Context:** Today the canvas hardcodes `insideColor='#ffb700'`, `outsideColor='#646cff'`, always animates, and never calls `cancelAnimationFrame` on unmount (leak). Make it token-driven, freeze on reduced-motion, dim in light mode, and clean up properly.

- [ ] **Step 1: Update the component to accept tokens + reduced-motion and fix cleanup**

Replace the component with a version that:
1. Imports `useReducedMotion` and `useTheme`.
2. Reads `tokens.galaxyInside`, `tokens.galaxyOutside`, `tokens.galaxyOpacity` for `parameters.insideColor/outsideColor` and applies opacity to the renderer DOM element (`renderer.domElement.style.opacity = String(tokens.galaxyOpacity)`).
3. Stores the rAF id: `let frameId = 0;` then `frameId = requestAnimationFrame(animate);` inside `animate`, and in cleanup `cancelAnimationFrame(frameId);`.
4. When `reduced` is true: render a single static frame (call `renderer.render(scene, camera)` once) and do NOT start the `animate()` loop.
5. Adds `[reduced, tokens.galaxyInside, tokens.galaxyOutside, tokens.galaxyOpacity]` to the `useEffect` dependency array so it rebuilds when theme/motion change.

Concrete diff of the key parts:

```tsx
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { useReducedMotion } from '../../../../hooks/useReducedMotion';
import { useTheme } from '../../../../contexts/ThemeContext';

export const GalaxyCanvas = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const { tokens } = useTheme();

  useEffect(() => {
    if (!containerRef.current) return;
    // ...existing setup...
    renderer.domElement.style.opacity = String(tokens.galaxyOpacity);
    renderer.domElement.style.transition = 'opacity .8s ease';

    const parameters = {
      count: 2000, size: 2, radius: 8, branches: 4, spin: 2, randomness: 1.3,
      insideColor: tokens.galaxyInside,
      outsideColor: tokens.galaxyOutside,
    };
    // ...existing geometry/material/points setup unchanged...

    let frameId = 0;
    const animate = () => {
      frameId = requestAnimationFrame(animate);
      galaxy.rotation.y += 0.0015;
      renderer.render(scene, camera);
    };

    if (reduced) {
      renderer.render(scene, camera); // single static frame
    } else {
      animate();
    }

    const handleResize = () => { /* ...unchanged... */ };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
      geometry.dispose();
      material.dispose();
      containerRef.current?.removeChild(renderer.domElement);
    };
  }, [reduced, tokens.galaxyInside, tokens.galaxyOutside, tokens.galaxyOpacity]);

  return ( /* ...unchanged container div... */ );
};
```

Keep all other existing setup lines (scene, camera, renderer, geometry, shader material, points) intact — only the listed parts change.

- [ ] **Step 2: Verify build/type check**

Run: `npx tsc --noEmit`
Expected: no new errors in `galaxy-canvas.tsx`.

- [ ] **Step 3: Commit**

```bash
git add UI/src/features/pages/regular/home/galaxy-canvas.tsx
git commit -m "feat(home): token-driven galaxy, reduced-motion freeze, fix rAF leak"
```

---

## Task 7: Header — brand text, nav glow, restore theme toggle

**Files:**
- Modify: `UI/src/features/pages/regular/main-window/main-window.tsx`
- Test: `UI/src/features/pages/regular/main-window/__tests__/header.test.tsx`

**Changes:**
1. Brand text "Stellar Security Portal" beside the logo (the `<Typography variant="h6">` placeholder at lines ~164-166), visible `sm` and up, using `fontWeight:800`, gradient text (gold→blue) via `background: linear-gradient(...); WebkitBackgroundClip:'text'; color:'transparent'`.
2. Active nav button: gold text + an animated underline glow (keep existing active sizing logic).
3. Restore the theme toggle: remove `visibility: 'hidden'` from the toggle `IconButton` (lines ~185-191) so it shows the sun/moon icon and works.

- [ ] **Step 1: Write the failing test**

```tsx
// UI/src/features/pages/regular/main-window/__tests__/header.test.tsx
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const file = readFileSync(
  resolve(__dirname, '..', 'main-window.tsx'), 'utf8',
);

describe('header redesign', () => {
  it('renders the Stellar brand text', () => {
    expect(file).toContain('Stellar Security Portal');
  });
  it('no longer hides the theme toggle', () => {
    expect(file).not.toContain("visibility: 'hidden'");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/pages/regular/main-window/__tests__/header.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Apply header changes**

Replace the logo `Typography` placeholder (lines ~164-166) with:

```tsx
<Typography
  variant="h6"
  sx={{
    display: { xs: 'none', sm: 'block' },
    fontWeight: 800,
    letterSpacing: '0.01em',
    background: 'linear-gradient(90deg, #FFD84D 0%, #2D4EFF 100%)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
  }}
>
  Stellar Security Portal
</Typography>
```

In the active nav `Button` `sx` (lines ~127-136), add an underline-glow for the active item:

```tsx
position: 'relative',
'&::after': isActive ? {
  content: '""',
  position: 'absolute',
  left: '12%', right: '12%', bottom: 6, height: 2,
  background: AccentColors.navigationActive,
  boxShadow: `0 0 8px ${AccentColors.navigationActive}`,
  borderRadius: 2,
} : undefined,
```

Remove `visibility: 'hidden'` from the theme-toggle `IconButton` (lines ~185-191); keep `color="inherit"`, `onClick={toggleTheme}`, `sx={{ mr: 1 }}`, and a `Tooltip title="Toggle light/dark theme"` wrapper.

- [ ] **Step 4: Run test + type check**

Run: `npx vitest run src/features/pages/regular/main-window/__tests__/header.test.tsx && npx tsc --noEmit`
Expected: PASS, no type errors.

- [ ] **Step 5: Commit**

```bash
git add UI/src/features/pages/regular/main-window/main-window.tsx UI/src/features/pages/regular/main-window/__tests__/header.test.tsx
git commit -m "feat(header): Stellar brand text, active-nav glow, restore theme toggle"
```

---

## Task 8: Home / hero restyle + scroll reveal

**Files:**
- Modify: `UI/src/features/pages/regular/home/home.tsx`

**Changes (keep layout & content order, keep `GalaxyCanvas`, keep Warp/Learn More handlers):**
1. Set the hero wrapper background to `tokens.heroBackground` (so light mode shows the dawn sky, dark shows deep space). Use `const { tokens } = useTheme();`.
2. Tighten the hero title text-shadow: keep the gold outline in dark, but in light mode use a subtle shadow (read `themeMode`). Simplest: replace the heavy 8-direction shadow with `textShadow: themeMode === 'dark' ? '0 0 24px rgba(45,78,255,0.55)' : '0 1px 2px rgba(0,0,0,0.15)'`.
3. Wrap `<StatisticsChanges/>`, `<RolesInfo/>`, and the pie-chart `Box` each in `<RevealOnScroll>` (stagger with `delay={0/120/240}`).
4. Give the CTA buttons a neon glow on hover (Warp already has glitter; add `boxShadow` hover via sx).

- [ ] **Step 1: Apply changes** (import `useTheme`, `RevealOnScroll`; set background; wrap sections).

Example for the sections region:

```tsx
import { RevealOnScroll } from '../../../../components/common/RevealOnScroll';
import { useTheme } from '../../../../contexts/ThemeContext';
// ...
const { tokens, themeMode } = useTheme();
// hero wrapper Box sx: add `background: tokens.heroBackground`
// ...
<RevealOnScroll>
  <Box sx={{ pt: 10 }}><StatisticsChanges /></Box>
</RevealOnScroll>
<RevealOnScroll delay={120}>
  <Box sx={{ pt: 10 }}><RolesInfo isCompact={isOnSmallScreen} /></Box>
</RevealOnScroll>
{!isOnSmallScreen && (
  <RevealOnScroll delay={240}>
    <Box sx={{ width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', pt: { xs: 10, md: 20 }, pb: 20 }}>
      <VulnerabilityPieChart height={350} width={350} />
    </Box>
  </RevealOnScroll>
)}
```

- [ ] **Step 2: Type check + build**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add UI/src/features/pages/regular/home/home.tsx
git commit -m "feat(home): cosmic hero background, neon CTAs, scroll-reveal sections"
```

---

## Task 9: Footer polish

**Files:**
- Modify: `UI/src/features/pages/regular/main-window/main-window.tsx` (footer block, lines ~370-516)

**Changes:** keep all content & links. Add a top hairline border (`borderTop: 1px solid divider`), a subtle section gradient background (`tokens.sectionGradient`), and hover-glow on social `IconButton`s (gold glow on hover). Do not change hrefs or subscribe logic.

- [ ] **Step 1: Apply footer sx changes** — set footer `Box` `sx` to include `borderTop`, `background: tokens.sectionGradient`; on the social icon container `'& .MuiButtonBase-root:hover'` add `{ color: '#FFD84D', filter: 'drop-shadow(0 0 6px rgba(255,216,77,0.6))' }`.

- [ ] **Step 2: Type check**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add UI/src/features/pages/regular/main-window/main-window.tsx
git commit -m "feat(footer): hairline + section gradient + social hover glow"
```

---

## Task 10: Lists & detail pages — apply CosmicSurface/tokens

**Files (modify, one commit per file group):**
- `UI/src/features/pages/regular/reports/*` (list cards/headers)
- `UI/src/features/pages/regular/vulnerabilities/*`
- `UI/src/features/pages/regular/vulnerability-details/vulnerability-details.tsx`
- `UI/src/features/pages/regular/report-details/report-details.tsx`
- `UI/src/features/pages/regular/protocol-details/protocol-details.tsx`
- `UI/src/features/pages/regular/auditor-details/auditor-details.tsx`
- `UI/src/features/pages/regular/company-details/company-details.tsx`

**Approach (per page):**
1. Identify the main content card(s) — usually a `Paper`/`Box` with a hardcoded background or border.
2. Wrap or replace the outer card with `<CosmicSurface sx={{ p: ... }}>` (or apply its sx to the existing `Box`), removing now-redundant hardcoded `backgroundColor`/`boxShadow` that conflict with the theme.
3. Replace hardcoded text/border hex that clashes with the theme (e.g. `#fff`, `#1e1e1e`) with theme values (`'background.paper'`, `'text.primary'`, `'divider'`). Leave severity colors as-is.
4. Section headings: `fontWeight: 700`.

**Important:** Do not change data fetching, props, routing, or component structure — only presentational `sx`/wrapper changes. Read each file first; if a page already uses theme palette values, leave it.

- [ ] **Step 1: Refactor reports + vulnerabilities list pages**, then `npx tsc --noEmit`, then commit:

```bash
git add UI/src/features/pages/regular/reports UI/src/features/pages/regular/vulnerabilities
git commit -m "style(lists): apply cosmic surfaces to reports & vulnerabilities lists"
```

- [ ] **Step 2: Refactor the five detail pages**, then `npx tsc --noEmit`, then commit:

```bash
git add UI/src/features/pages/regular/*-details
git commit -m "style(details): apply cosmic surfaces to detail pages"
```

- [ ] **Step 3: Visual sanity check in dev server** (Task 13 covers the full Playwright pass).

---

## Task 11: Authentication (login) page restyle

**Files:**
- Modify: `UI/src/features/authentication/authentication.tsx`

**Changes:** keep all form fields, OIDC/login logic, and error handling. Restyle the card with `CosmicSurface`-style border/glow, set background to `tokens.heroBackground` for the page wrapper, ensure the logo + "Stellar Security Portal" alt/text read well in both themes.

- [ ] **Step 1: Read the file, apply presentational changes only** (wrapper background = `tokens.heroBackground`, card uses surface tokens). Do not alter login handlers.

- [ ] **Step 2: Type check**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add UI/src/features/authentication/authentication.tsx
git commit -m "style(auth): cosmic login background + surface"
```

---

## Task 12: Full verification — build, lint, tests

- [ ] **Step 1: Run the unit test suite**

Run (from `UI/`): `npx vitest run`
Expected: all tests pass. If a pre-existing snapshot/assertion broke due to intentional theme color changes, update it to the new value and note it in the commit.

- [ ] **Step 2: Lint**

Run: `npm run lint`
Expected: 0 errors (max-warnings 0). Fix any introduced by new files.

- [ ] **Step 3: Production build**

Run: `npm run build`
Expected: `tsc` + both Vite builds succeed.

- [ ] **Step 4: Commit any fixups**

```bash
git add -A
git commit -m "test(redesign): fixups for build/lint/tests"
```

---

## Task 13: Deploy to dev + Playwright (non-headless) verification

**Note:** Manual deploy only. **Do not trigger CI/CD.** Tag images `redesign`.

- [ ] **Step 1: Build & push Docker images** (from repo root) — UI and API as needed. UI image:

```bash
docker login -u andreykerchin
# (PAT provided by user)
docker build -t andreykerchin/soroban-security-portal-ui:redesign -f UI/Dockerfile UI
docker push andreykerchin/soroban-security-portal-ui:redesign
```

(Only the UI image changes for this redesign; API image unchanged — reuse existing tag.)

- [ ] **Step 2: Deploy via helm to dev** (uses `kubeconfig.temp`):

```bash
KUBECONFIG=./kubeconfig.temp helm upgrade sorobansecurityportal Deploy/helm \
  -n sorobansecurityportal-ns --reuse-values \
  --set global.sorobansecurityportal.service.uiTag=redesign
```

(Confirm the exact value key from `Deploy/helm/values.yaml` before running; if a single tag drives both images, set it to a tag that also has a valid API image — otherwise push an API image under `:redesign` too. Verify ProductVersion/migration implications: a purely-UI redesign should not run DB migrations.)

- [ ] **Step 2.5: Confirm rollout**

```bash
KUBECONFIG=./kubeconfig.temp kubectl -n sorobansecurityportal-ns rollout status deploy -l app.kubernetes.io/name=sorobansecurityportal
```

- [ ] **Step 3: Playwright non-headless walkthrough** of https://sorobanshield.ru :
  - Home: hero shows "STELLAR SECURITY PORTAL", galaxy renders, sections reveal on scroll.
  - Header: brand text visible, theme toggle present and switches light/dark; both themes look correct.
  - Lists: reports & vulnerabilities cards use the new surfaces; severity chips intact.
  - Detail pages: at least one vulnerability + one report render with new surfaces.
  - Login page (`/login`): renamed + restyled; login still works (admin creds provided).
  - Reduced-motion: emulate `prefers-reduced-motion: reduce` → galaxy static, no scroll-reveal animation, content fully visible.
  - Rename: `document.title` = "Stellar Security Portal"; OG `og:site_name` updated; crawler OG route still returns server-rendered tags (unchanged behavior).
  - Capture screenshots of each (light + dark) for the PR.

- [ ] **Step 4: Record results.** If any check fails, fix on the branch, rebuild/redeploy, re-verify. Do not claim success without screenshots/evidence.

---

## Self-Review (completed during planning)

- **Spec coverage:** palette/tokens (T1), reduced-motion (T2), theme+toggle (T3), rename (T4), surfaces+reveal (T5), galaxy+leak fix (T6), header (T7), home/hero (T8), footer (T9), lists+detail (T10), login (T11), build/lint/test (T12), deploy+Playwright (T13). All spec sections mapped.
- **Placeholders:** none — code provided for all infra tasks; visual tasks give concrete sx + exact files. T10/T11 require reading the target files first (presentational changes only), which is stated explicitly.
- **Type consistency:** `ThemeTokens` keys used by `tokens.ts`, `CosmicSurface`, `GalaxyCanvas` match; `useTheme()` returns `{ themeMode, toggleTheme, theme, tokens }` consistently; `useReducedMotion()` returns `boolean` used by T2/T5/T6.
