/**
 * Responsive layout utilities that replace defaultUiSettings.
 * Uses MUI breakpoints for proper responsive behavior.
 *
 * These SxProps values can be used directly in the sx prop of MUI components:
 * ```tsx
 * <Box sx={listAreaStyle}>...</Box>
 * <TextField sx={formControlWidth} />
 * ```
 *
 * @see constants.ts for the dimension values used here
 * @deprecated defaultUiSettings.ts - Use these utilities instead
 */
import { SxProps, Theme } from '@mui/material/styles';
import { Layout, FormDimensions } from './constants';

/**
 * Responsive form control width.
 * Replaces: defaultUiSettings.editControlSize ('850px')
 *
 * Breakpoints:
 * - xs/sm (< 900px): 100% width for mobile/tablet
 * - md (900-1200px): 650px for medium screens
 * - lg (> 1200px): 850px for large screens
 */
export const formControlWidth: SxProps<Theme> = {
  width: FormDimensions.controlWidth,
};

/**
 * Responsive edit area container style.
 * Replaces: defaultUiSettings.editAreaStyle
 *
 * Changes from original:
 * - Adds minHeight for better mobile experience
 * - Uses responsive height instead of fixed calc()
 * - Adds horizontal padding on mobile
 */
export const editAreaStyle: SxProps<Theme> = {
  height: {
    xs: 'auto',
    md: `calc(100vh - ${Layout.appBarOffset}px)`,
  },
  minHeight: '60vh',
  display: 'flow-root',
  position: 'relative',
  overflowY: 'auto',
  px: { xs: 2, md: 0 },
};

/**
 * Responsive list area container style.
 * Replaces: defaultUiSettings.listAreaStyle
 *
 * CRITICAL FIX: Removed 110vw width that caused horizontal scrolling issues.
 * Now uses 100% width with proper overflow handling.
 */
export const listAreaStyle: SxProps<Theme> = {
  height: {
    xs: 'auto',
    md: `calc(100vh - ${Layout.appBarOffset}px)`,
  },
  minHeight: '60vh',
  display: 'flow-root',
  width: '100%',
  maxWidth: '100%',
  overflowX: 'auto',
};

/**
 * DataGrid container height.
 * Replaces: calc(100vh - 128px) inline styles
 *
 * Provides consistent DataGrid container sizing across admin pages.
 */
export const dataGridContainerStyle: SxProps<Theme> = {
  height: {
    xs: '60vh',
    md: `calc(100vh - ${Layout.appBarOffset}px)`,
  },
  position: 'relative',
};

/**
 * Settings page control width.
 * For admin settings page that uses fixed widths.
 *
 * Responsive: 100% on mobile, fixed 594px on sm and above.
 */
export const settingsControlStyle: SxProps<Theme> = {
  width: {
    xs: '100%',
    sm: FormDimensions.settingsControlWidth,
  },
};
