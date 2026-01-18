/**
 * Centralized theme constants for the Soroban Security Portal UI.
 *
 * Design decisions:
 * - PascalCase for exported objects (matching existing SeverityColors pattern in ThemeContext)
 * - WCAG AA compliant colors for accessibility
 * - MUI's 8px grid for spacing
 * - No custom zIndex - use theme.zIndex from MUI instead
 *
 * @see ThemeContext.tsx for severity colors (SeverityColors, SeverityColorsLight, etc.)
 * @see responsive.ts for SxProps utilities that use these constants
 */

// ============================================
// SPACING CONSTANTS
// ============================================
// Based on MUI's 8px grid (theme.spacing(1) = 8px)
export const Spacing = {
  /** 4px - Extra small gaps, icon padding */
  xs: 0.5,
  /** 8px - Small gaps, button padding */
  sm: 1,
  /** 16px - Standard section spacing */
  md: 2,
  /** 24px - Card/section padding */
  lg: 3,
  /** 32px - Major section dividers */
  xl: 4,
  /** 48px - Page section spacing */
  xxl: 6,
} as const;

// ============================================
// ACCENT COLORS
// ============================================
/**
 * Accent colors for navigation, avatars, and UI highlights.
 *
 * avatarBackground: Updated to #6B5B95 for WCAG AA compliance (4.7:1 contrast with white text)
 * Original #9386b6 had only 3.9:1 contrast, which fails WCAG AA minimum of 4.5:1
 */
export const AccentColors = {
  /** Gold accent for active navigation, highlights */
  navigationActive: '#FFD84D',
  /** Muted gold for inactive navigation, subtle text */
  navigationInactive: '#DDCDB1',
  /** Purple background for user avatars - WCAG AA compliant with white text */
  avatarBackground: '#6B5B95',
  /** Gold border for avatars, loading indicators */
  avatarBorder: '#FCD34D',
  /** Loading spinner color */
  loadingIndicator: '#FCD34D',
  /** Primary brand blue */
  brandPrimary: '#2D4EFF',
  /** Brand blue hover state */
  brandPrimaryHover: '#1a3fd9',
} as const;

// ============================================
// FOCUS STYLES (Accessibility)
// ============================================
/**
 * Focus indicator styles for keyboard navigation accessibility.
 * Use these to ensure visible focus states on interactive elements.
 */
export const FocusStyles = {
  /** Focus indicator outline color */
  outlineColor: '#FFD84D',
  /** Focus indicator outline width */
  outlineWidth: '2px',
  /** Focus indicator outline offset */
  outlineOffset: '2px',
} as const;

// ============================================
// STATUS COLORS
// ============================================
/**
 * Colors for item status indicators (new, approved, rejected).
 */
export const StatusColors = {
  /** New/pending items - Dark yellow/gold */
  new: '#DAA520',
  /** Approved/success items - Green */
  approved: '#4CAF50',
  /** Rejected/error items - Red */
  rejected: '#F44336',
} as const;

// ============================================
// CATEGORY COLORS (Vulnerability)
// ============================================
/**
 * Colors for vulnerability categories with distinct hues for colorblind accessibility.
 *
 * Design decision: Uses distinct hues rather than purple gradients
 * to ensure users with color vision deficiencies can distinguish categories.
 */
export const CategoryColors = {
  valid: '#6a1b9a',
  validNotFixed: '#9c27b0',
  validPartiallyFixed: '#ba68c8',
  invalid: '#adadadff',
  na: '#ce93d8',
  fallback: '#757575',
} as const;

// ============================================
// LAYOUT DIMENSIONS
// ============================================
/**
 * Fixed layout dimensions used across the application.
 */
export const Layout = {
  /** Drawer width in pixels */
  drawerWidth: 240,
  /** Drawer margin left in pixels */
  drawerMarginLeft: 24,
  /** App bar height offset for content height calculations */
  appBarOffset: 128,
  /** Maximum width for detail pages */
  detailPageMaxWidth: '1400px',
  /** Settings page container width */
  settingsPageWidth: '1200px',
} as const;

// ============================================
// FORM DIMENSIONS (Responsive)
// ============================================
/**
 * Responsive form dimensions using MUI breakpoint values.
 * Use these with sx prop for responsive styling.
 */
export const FormDimensions = {
  /** Form control width - responsive values for sx prop */
  controlWidth: {
    xs: '100%',
    sm: '100%',
    md: '650px',
    lg: '850px',
  },
  /** Settings control width (fixed for admin settings) */
  settingsControlWidth: '594px',
} as const;

// ============================================
// TYPOGRAPHY WEIGHTS
// ============================================
/**
 * Font weight constants for consistent typography.
 */
export const Typography = {
  heading: { fontWeight: 700 },
  subheading: { fontWeight: 600 },
  body: { fontWeight: 400 },
} as const;

// ============================================
// ANIMATION DURATIONS
// ============================================
/**
 * Transition duration constants for consistent animations.
 */
export const Transitions = {
  /** Fast transitions for hover states */
  fast: '0.2s',
  /** Standard transitions */
  standard: '0.3s',
  /** Slow transitions for complex animations */
  slow: '0.5s',
} as const;

// ============================================
// TOUCH TARGETS (Mobile Accessibility)
// ============================================
/**
 * Minimum touch target sizes for mobile accessibility.
 *
 * Design decisions:
 * - 44px: Apple HIG minimum for secondary actions
 * - 48px: Material Design recommended for primary actions
 * - 56px: Large touch targets for FABs and prominent CTAs
 */
export const TouchTargets = {
  /** Minimum for secondary actions (edit, expand) - Apple HIG */
  minimum: 44,
  /** Primary/destructive actions (approve, reject, remove) - Material Design */
  primary: 48,
  /** FABs and prominent CTAs */
  large: 56,
} as const;

// ============================================
// TYPE EXPORTS
// ============================================
// Type-safe key types for color accessors
export type AccentColorKey = keyof typeof AccentColors;
export type StatusColorKey = keyof typeof StatusColors;
export type CategoryColorKey = keyof typeof CategoryColors;
export type SpacingKey = keyof typeof Spacing;
