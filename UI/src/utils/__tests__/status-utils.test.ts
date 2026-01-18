import { describe, it, expect } from 'vitest';
import { getStatusColor, formatDateTime, formatDate } from '../status-utils';
import { StatusColors } from '../../theme';

describe('status-utils', () => {
  describe('getStatusColor', () => {
    it('returns correct color for "new" status', () => {
      expect(getStatusColor('new')).toBe(StatusColors.new);
      expect(getStatusColor('New')).toBe(StatusColors.new);
      expect(getStatusColor('NEW')).toBe(StatusColors.new);
    });

    it('returns correct color for "approved" status', () => {
      expect(getStatusColor('approved')).toBe(StatusColors.approved);
      expect(getStatusColor('Approved')).toBe(StatusColors.approved);
      expect(getStatusColor('APPROVED')).toBe(StatusColors.approved);
    });

    it('returns correct color for "rejected" status', () => {
      expect(getStatusColor('rejected')).toBe(StatusColors.rejected);
      expect(getStatusColor('Rejected')).toBe(StatusColors.rejected);
      expect(getStatusColor('REJECTED')).toBe(StatusColors.rejected);
    });

    it('returns "inherit" for unknown status', () => {
      expect(getStatusColor('unknown')).toBe('inherit');
      expect(getStatusColor('pending')).toBe('inherit');
      expect(getStatusColor('active')).toBe('inherit');
      expect(getStatusColor('')).toBe('inherit');
    });

    it('is case insensitive', () => {
      expect(getStatusColor('NeW')).toBe(StatusColors.new);
      expect(getStatusColor('aPpRoVeD')).toBe(StatusColors.approved);
      expect(getStatusColor('rEjEcTeD')).toBe(StatusColors.rejected);
    });
  });

  describe('formatDateTime', () => {
    it('formats ISO datetime string correctly', () => {
      expect(formatDateTime('2024-01-15T14:30:00.000Z')).toBe('2024-01-15 14:30:00');
      expect(formatDateTime('2026-12-25T09:15:45.123Z')).toBe('2026-12-25 09:15:45');
    });

    it('removes milliseconds', () => {
      const result = formatDateTime('2024-01-15T14:30:00.999Z');
      expect(result).not.toContain('.');
      expect(result).toBe('2024-01-15 14:30:00');
    });

    it('replaces T with space', () => {
      const result = formatDateTime('2024-01-15T14:30:00Z');
      expect(result).not.toContain('T');
      expect(result).toContain(' ');
    });

    it('handles datetime without milliseconds', () => {
      expect(formatDateTime('2024-01-15T14:30:00Z')).toBe('2024-01-15 14:30:00Z');
    });

    it('returns empty string for null', () => {
      expect(formatDateTime(null)).toBe('');
    });

    it('returns empty string for undefined', () => {
      expect(formatDateTime(undefined)).toBe('');
    });

    it('returns empty string for empty string', () => {
      expect(formatDateTime('')).toBe('');
    });

    it('handles various datetime formats', () => {
      expect(formatDateTime('2024-06-01T00:00:00.000')).toBe('2024-06-01 00:00:00');
      expect(formatDateTime('2024-12-31T23:59:59.999')).toBe('2024-12-31 23:59:59');
    });
  });

  describe('formatDate', () => {
    it('extracts date portion from ISO datetime', () => {
      expect(formatDate('2024-01-15T14:30:00.000Z')).toBe('2024-01-15');
      expect(formatDate('2026-12-25T09:15:45.123Z')).toBe('2026-12-25');
    });

    it('handles date-only strings', () => {
      expect(formatDate('2024-01-15')).toBe('2024-01-15');
      expect(formatDate('2026-12-25')).toBe('2026-12-25');
    });

    it('returns empty string for null', () => {
      expect(formatDate(null)).toBe('');
    });

    it('returns empty string for undefined', () => {
      expect(formatDate(undefined)).toBe('');
    });

    it('returns empty string for empty string', () => {
      expect(formatDate('')).toBe('');
    });

    it('handles year boundaries', () => {
      expect(formatDate('2024-01-01T00:00:00.000Z')).toBe('2024-01-01');
      expect(formatDate('2024-12-31T23:59:59.999Z')).toBe('2024-12-31');
    });

    it('handles leap year dates', () => {
      expect(formatDate('2024-02-29T12:00:00.000Z')).toBe('2024-02-29');
    });
  });
});
