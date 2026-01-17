import { GridColDef } from '@mui/x-data-grid';

/**
 * Column priority levels for responsive visibility.
 * - essential: Always visible (e.g., name, actions)
 * - important: Visible on tablet and up (e.g., status, dates)
 * - optional: Only visible on desktop (e.g., descriptions, metadata)
 */
export type ColumnPriority = 'essential' | 'important' | 'optional';

/**
 * Extended column definition with responsive configuration options.
 * Uses intersection type with GridColDef for proper TypeScript compatibility.
 *
 * @remarks When hideOnMobile/hideOnTablet are not explicitly set,
 * visibility is derived from priority:
 * - optional: hidden on mobile and tablet
 * - important: hidden on mobile only
 * - essential: always visible
 */
export type ResponsiveColumn = GridColDef & {
  /** Column priority for auto-hiding logic when explicit flags not set */
  priority?: ColumnPriority;
  /** Hide this column on mobile (xs, sm breakpoints). Overrides priority. */
  hideOnMobile?: boolean;
  /** Hide this column on tablet (md breakpoint). Overrides priority. */
  hideOnTablet?: boolean;
  /** Column width to use on mobile (uses minWidth with flex) */
  mobileWidth?: number;
};

/**
 * Transforms ResponsiveColumn[] to GridColDef[] based on current breakpoint.
 * Applies column visibility and responsive width adjustments.
 *
 * Visibility Rules:
 * 1. Explicit hideOnMobile/hideOnTablet flags always take precedence
 * 2. When explicit flags are not set, priority determines visibility:
 *    - essential: Always visible
 *    - important: Visible on tablet+, hidden on mobile (unless hideOnMobile explicitly false)
 *    - optional: Hidden on mobile and tablet (unless explicitly overridden)
 *
 * @param columns - Array of responsive column definitions
 * @param breakpoint - Current viewport breakpoint
 * @returns Filtered and adjusted GridColDef[] for DataGrid
 *
 * @example
 * ```tsx
 * const { breakpoint } = useResponsive();
 * const responsiveColumns = getResponsiveColumns(columns, breakpoint);
 * return <DataGrid columns={responsiveColumns} />;
 * ```
 */
export function getResponsiveColumns(
  columns: ResponsiveColumn[],
  breakpoint: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
): GridColDef[] {
  const isMobile = breakpoint === 'xs' || breakpoint === 'sm';
  const isTablet = breakpoint === 'md';

  return columns
    .filter(col => {
      // 1. Check explicit hide flags first (backward compatibility)
      if (isMobile && col.hideOnMobile === true) return false;
      if (isTablet && col.hideOnTablet === true) return false;

      // 2. If explicit flags are set to false, respect that and show the column
      if (isMobile && col.hideOnMobile === false) return true;
      if (isTablet && col.hideOnTablet === false) return true;

      // 3. Apply priority-based auto-hiding when explicit flags are undefined
      const priority = col.priority ?? 'essential'; // Default to essential if not specified

      if (isMobile) {
        // On mobile: hide optional and important (only essential visible by default)
        if (priority === 'optional') return false;
        if (priority === 'important') return false;
      }

      if (isTablet) {
        // On tablet: hide optional only (important and essential visible)
        if (priority === 'optional') return false;
      }

      return true;
    })
    .map((col): GridColDef => {
      // Remove custom responsive properties before returning
      const { priority, hideOnMobile, hideOnTablet, mobileWidth, ...baseCol } = col;

      if (!isMobile) return baseCol;

      // On mobile: use minWidth with flex for proper sizing
      if (mobileWidth) {
        return {
          ...baseCol,
          minWidth: mobileWidth,
          width: undefined,
          flex: 1
        };
      }
      // Default: use flex only if no explicit width preference
      return {
        ...baseCol,
        flex: baseCol.flex ?? 1
      };
    });
}
