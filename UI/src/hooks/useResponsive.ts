import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';

/**
 * Responsive state for centralized breakpoint detection.
 * Uses MUI theme breakpoints for consistent responsive behavior.
 */
export interface ResponsiveState {
  /** xs, sm breakpoints (< 900px) */
  isMobile: boolean;
  /** md breakpoint (900-1200px) */
  isTablet: boolean;
  /** lg+ breakpoints (>= 1200px) */
  isDesktop: boolean;
  /** xs only (< 600px) */
  isSmallScreen: boolean;
  /** Current breakpoint name */
  breakpoint: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
}

/**
 * Hook for centralized responsive breakpoint detection.
 * Optimized to use only 4 media query listeners.
 *
 * @example
 * ```tsx
 * const { isMobile, isTablet, breakpoint } = useResponsive();
 *
 * return (
 *   <Box sx={{ padding: isMobile ? 1 : 3 }}>
 *     {!isMobile && <SidePanel />}
 *     <Content />
 *   </Box>
 * );
 * ```
 */
export function useResponsive(): ResponsiveState {
  const theme = useTheme();

  // Only 4 media query listeners (optimized from 8)
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const isTablet = useMediaQuery(theme.breakpoints.between('md', 'lg'));
  const isDesktop = useMediaQuery(theme.breakpoints.up('lg'));
  const isSmallScreen = useMediaQuery(theme.breakpoints.down('sm'));

  // Derive breakpoint from boolean flags instead of additional queries
  const breakpoint: 'xs' | 'sm' | 'md' | 'lg' | 'xl' =
    isSmallScreen ? 'xs' :
    isMobile ? 'sm' :
    isTablet ? 'md' :
    isDesktop ? 'lg' : 'xl';

  return { isMobile, isTablet, isDesktop, isSmallScreen, breakpoint };
}
