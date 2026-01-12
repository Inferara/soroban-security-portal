/**
 * Date formatting utilities for the detail pages.
 * These functions provide human-readable date formatting for display purposes.
 */

/**
 * Formats a date for long-form display (e.g., "January 15, 2024").
 * Used in detail page headers and timestamps.
 *
 * @param dateString - Date string or Date object to format
 * @returns Formatted date string, or 'Unknown date' if invalid
 *
 * @example
 * ```tsx
 * <Typography>Since {formatDateLong(auditor.date)}</Typography>
 * // Output: "Since January 15, 2024"
 * ```
 */
export function formatDateLong(dateString: Date | string | null | undefined): string {
  if (!dateString) return 'Unknown date';
  try {
    return new Date(dateString).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  } catch {
    return 'Unknown date';
  }
}

/**
 * Formats a month key (YYYY-MM format) into human-readable form (e.g., "Jan 2024").
 * Used in timeline charts.
 *
 * @param monthKey - Month key in YYYY-MM format
 * @returns Formatted month-year string
 *
 * @example
 * ```tsx
 * const labels = timeline.map(item => formatMonthYear(item.month));
 * // Input: "2024-01" -> Output: "Jan 2024"
 * ```
 */
export function formatMonthYear(monthKey: string): string {
  if (!monthKey) return '';
  const [year, month] = monthKey.split('-');
  if (!year || !month) return monthKey;
  const date = new Date(parseInt(year), parseInt(month) - 1);
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short' });
}
