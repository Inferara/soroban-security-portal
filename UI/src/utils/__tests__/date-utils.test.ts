import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { formatDateLong, formatMonthYear } from '../date-utils';

describe('date-utils', () => {
  describe('formatDateLong', () => {
    // Mock toLocaleDateString for consistent testing across locales
    beforeEach(() => {
      vi.spyOn(Date.prototype, 'toLocaleDateString').mockImplementation(function(
        this: Date,
        _locale,
        options
      ) {
        const months = [
          'January', 'February', 'March', 'April', 'May', 'June',
          'July', 'August', 'September', 'October', 'November', 'December'
        ];
        const month = months[this.getMonth()];
        const day = this.getDate();
        const year = this.getFullYear();

        if (options?.month === 'long') {
          return `${month} ${day}, ${year}`;
        }
        if (options?.month === 'short') {
          return `${month.slice(0, 3)} ${year}`;
        }
        return `${month} ${day}, ${year}`;
      });
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('formats a valid date string correctly', () => {
      expect(formatDateLong('2026-01-15')).toBe('January 15, 2026');
      expect(formatDateLong('2024-12-25')).toBe('December 25, 2024');
      expect(formatDateLong('2023-06-01')).toBe('June 1, 2023');
    });

    it('formats a Date object correctly', () => {
      expect(formatDateLong(new Date(2026, 0, 15))).toBe('January 15, 2026');
      expect(formatDateLong(new Date(2024, 11, 25))).toBe('December 25, 2024');
    });

    it('formats ISO date strings correctly', () => {
      expect(formatDateLong('2026-01-17T10:30:00.000Z')).toMatch(/January 17, 2026/);
    });

    it('returns "Unknown date" for null', () => {
      expect(formatDateLong(null)).toBe('Unknown date');
    });

    it('returns "Unknown date" for undefined', () => {
      expect(formatDateLong(undefined)).toBe('Unknown date');
    });

    it('returns "Unknown date" for empty string', () => {
      expect(formatDateLong('')).toBe('Unknown date');
    });

    it('returns "Unknown date" for invalid date strings', () => {
      // Restore mocks to test real behavior
      vi.restoreAllMocks();
      expect(formatDateLong('not-a-date')).toBe('Unknown date');
      expect(formatDateLong('invalid')).toBe('Unknown date');
      expect(formatDateLong('abc123')).toBe('Unknown date');
    });

    it('handles dates at year boundaries', () => {
      expect(formatDateLong('2026-01-01')).toBe('January 1, 2026');
      expect(formatDateLong('2025-12-31')).toBe('December 31, 2025');
    });

    it('handles leap year dates', () => {
      expect(formatDateLong('2024-02-29')).toBe('February 29, 2024');
    });
  });

  describe('formatMonthYear', () => {
    beforeEach(() => {
      vi.spyOn(Date.prototype, 'toLocaleDateString').mockImplementation(function(
        this: Date,
        _locale,
        options
      ) {
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        if (options?.month === 'short') {
          return `${months[this.getMonth()]} ${this.getFullYear()}`;
        }
        return '';
      });
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('formats month keys correctly', () => {
      expect(formatMonthYear('2026-01')).toBe('Jan 2026');
      expect(formatMonthYear('2025-12')).toBe('Dec 2025');
      expect(formatMonthYear('2024-06')).toBe('Jun 2024');
    });

    it('handles all 12 months', () => {
      expect(formatMonthYear('2026-01')).toBe('Jan 2026');
      expect(formatMonthYear('2026-02')).toBe('Feb 2026');
      expect(formatMonthYear('2026-03')).toBe('Mar 2026');
      expect(formatMonthYear('2026-04')).toBe('Apr 2026');
      expect(formatMonthYear('2026-05')).toBe('May 2026');
      expect(formatMonthYear('2026-06')).toBe('Jun 2026');
      expect(formatMonthYear('2026-07')).toBe('Jul 2026');
      expect(formatMonthYear('2026-08')).toBe('Aug 2026');
      expect(formatMonthYear('2026-09')).toBe('Sep 2026');
      expect(formatMonthYear('2026-10')).toBe('Oct 2026');
      expect(formatMonthYear('2026-11')).toBe('Nov 2026');
      expect(formatMonthYear('2026-12')).toBe('Dec 2026');
    });

    it('returns empty string for empty input', () => {
      expect(formatMonthYear('')).toBe('');
    });

    it('returns original string for invalid format', () => {
      expect(formatMonthYear('invalid')).toBe('invalid');
      expect(formatMonthYear('2026')).toBe('2026');
    });

    it('handles month key without leading zero', () => {
      // The function expects YYYY-MM format, but should handle single digit
      expect(formatMonthYear('2026-1')).toBe('Jan 2026');
    });

    it('handles different years', () => {
      expect(formatMonthYear('2020-06')).toBe('Jun 2020');
      expect(formatMonthYear('2030-06')).toBe('Jun 2030');
      expect(formatMonthYear('1999-12')).toBe('Dec 1999');
    });
  });
});
