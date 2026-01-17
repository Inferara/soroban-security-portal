import { StatusColors } from '../theme';

/**
 * Returns the appropriate color for a status value.
 * Used for displaying approval workflow statuses (new, approved, rejected).
 *
 * @param status - The status string to get color for
 * @returns A hex color code from StatusColors
 *
 * @example
 * ```tsx
 * <span style={{ color: getStatusColor('approved') }}>Approved</span>
 * ```
 */
export function getStatusColor(status: string): string {
  switch (status.toLowerCase()) {
    case 'new':
      return StatusColors.new;
    case 'approved':
      return StatusColors.approved;
    case 'rejected':
      return StatusColors.rejected;
    default:
      return 'inherit';
  }
}

/**
 * Formats a date/timestamp string for display.
 * Removes milliseconds and replaces T with a space.
 *
 * @param dateString - ISO date string to format
 * @returns Formatted date string (e.g., "2024-01-15 14:30:00")
 *
 * @example
 * ```tsx
 * <span>{formatDateTime(report.lastActionAt)}</span>
 * ```
 */
export function formatDateTime(dateString: string | null | undefined): string {
  if (!dateString) return '';
  return dateString.split('.')[0].replace('T', ' ');
}

/**
 * Formats a date string to show only the date portion.
 *
 * @param dateString - ISO date string to format
 * @returns Date portion only (e.g., "2024-01-15")
 *
 * @example
 * ```tsx
 * <span>{formatDate(report.date)}</span>
 * ```
 */
export function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return '';
  return dateString.split('T')[0];
}
