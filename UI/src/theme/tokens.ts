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
