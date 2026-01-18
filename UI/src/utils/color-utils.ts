/**
 * Color utilities for severity and category visualization.
 *
 * These utilities provide WCAG 2.1 AA compliant colors that are
 * accessible for colorblind users and meet contrast requirements.
 */

import {
  SeverityColors,
  SeverityColorsLight,
  SeverityTextColorsLight,
  SeverityTextColorsDark,
} from '../contexts/ThemeContext';

/**
 * Gets the appropriate color for a vulnerability severity level.
 * Returns the color from SeverityColors map, or a fallback grey color.
 *
 * @param severity - Severity level string (critical, high, medium, low, note)
 * @param fallbackColor - Color to return if severity not found (default: grey)
 * @returns Hex color string
 *
 * @example
 * ```tsx
 * <Avatar sx={{ bgcolor: getSeverityColor(vulnerability.severity) }}>
 *   <BugReport />
 * </Avatar>
 * ```
 */
export function getSeverityColor(severity: string | null | undefined, fallbackColor = '#9e9e9e'): string {
  if (!severity) return fallbackColor;
  const s = severity.toLowerCase();
  if (s in SeverityColors) {
    return SeverityColors[s];
  }
  return fallbackColor;
}

/**
 * Typed version of SeverityColors keys for type-safe access.
 */
export type SeverityLevel = 'critical' | 'high' | 'medium' | 'low' | 'note';

/**
 * Check if a string is a valid severity level.
 *
 * @param severity - String to check
 * @returns True if the string is a valid severity level
 */
export function isValidSeverity(severity: string): severity is SeverityLevel {
  return ['critical', 'high', 'medium', 'low', 'note'].includes(severity.toLowerCase());
}

/**
 * Gets a light/subtle background color for severity.
 * Use for hover states, table row highlights, subtle backgrounds.
 *
 * @param severity - Severity level string
 * @param fallbackColor - Color to return if severity not found
 * @returns Hex color string with low opacity
 */
export function getSeverityColorLight(severity: string | null | undefined, fallbackColor = '#9e9e9e20'): string {
  if (!severity) return fallbackColor;
  const s = severity.toLowerCase();
  if (s in SeverityColorsLight) {
    return SeverityColorsLight[s];
  }
  return fallbackColor;
}

/**
 * Gets the text color for severity labels based on theme mode.
 * These colors are optimized for text readability.
 *
 * @param severity - Severity level string
 * @param isDarkMode - Whether the app is in dark mode
 * @param fallbackColor - Color to return if severity not found
 * @returns Hex color string
 */
export function getSeverityTextColor(
  severity: string | null | undefined,
  isDarkMode = false,
  fallbackColor = '#6B7280'
): string {
  if (!severity) return fallbackColor;
  const s = severity.toLowerCase();
  const colorMap = isDarkMode ? SeverityTextColorsDark : SeverityTextColorsLight;
  if (s in colorMap) {
    return colorMap[s];
  }
  return fallbackColor;
}
