import { describe, it, expect } from 'vitest';
import {
  getSeverityColor,
  getSeverityColorLight,
  getSeverityTextColor,
  isValidSeverity,
  SeverityLevel,
} from '../color-utils';
import {
  SeverityColors,
  SeverityColorsLight,
  SeverityTextColorsLight,
  SeverityTextColorsDark,
} from '../../contexts/ThemeContext';

describe('color-utils', () => {
  describe('getSeverityColor', () => {
    it('returns correct color for critical severity', () => {
      expect(getSeverityColor('critical')).toBe(SeverityColors.critical);
      expect(getSeverityColor('Critical')).toBe(SeverityColors.critical);
      expect(getSeverityColor('CRITICAL')).toBe(SeverityColors.critical);
    });

    it('returns correct color for high severity', () => {
      expect(getSeverityColor('high')).toBe(SeverityColors.high);
      expect(getSeverityColor('High')).toBe(SeverityColors.high);
      expect(getSeverityColor('HIGH')).toBe(SeverityColors.high);
    });

    it('returns correct color for medium severity', () => {
      expect(getSeverityColor('medium')).toBe(SeverityColors.medium);
      expect(getSeverityColor('Medium')).toBe(SeverityColors.medium);
      expect(getSeverityColor('MEDIUM')).toBe(SeverityColors.medium);
    });

    it('returns correct color for low severity', () => {
      expect(getSeverityColor('low')).toBe(SeverityColors.low);
      expect(getSeverityColor('Low')).toBe(SeverityColors.low);
      expect(getSeverityColor('LOW')).toBe(SeverityColors.low);
    });

    it('returns correct color for note severity', () => {
      expect(getSeverityColor('note')).toBe(SeverityColors.note);
      expect(getSeverityColor('Note')).toBe(SeverityColors.note);
      expect(getSeverityColor('NOTE')).toBe(SeverityColors.note);
    });

    it('returns fallback color for null severity', () => {
      expect(getSeverityColor(null)).toBe('#9e9e9e');
    });

    it('returns fallback color for undefined severity', () => {
      expect(getSeverityColor(undefined)).toBe('#9e9e9e');
    });

    it('returns fallback color for empty string', () => {
      expect(getSeverityColor('')).toBe('#9e9e9e');
    });

    it('returns fallback color for unknown severity', () => {
      expect(getSeverityColor('unknown')).toBe('#9e9e9e');
      expect(getSeverityColor('severe')).toBe('#9e9e9e');
      expect(getSeverityColor('info')).toBe('#9e9e9e');
    });

    it('accepts custom fallback color', () => {
      expect(getSeverityColor(null, '#ff0000')).toBe('#ff0000');
      expect(getSeverityColor('unknown', '#00ff00')).toBe('#00ff00');
    });

    it('is case insensitive', () => {
      expect(getSeverityColor('CrItIcAl')).toBe(SeverityColors.critical);
      expect(getSeverityColor('hIgH')).toBe(SeverityColors.high);
    });
  });

  describe('getSeverityColorLight', () => {
    it('returns correct light color for each severity', () => {
      expect(getSeverityColorLight('critical')).toBe(SeverityColorsLight.critical);
      expect(getSeverityColorLight('high')).toBe(SeverityColorsLight.high);
      expect(getSeverityColorLight('medium')).toBe(SeverityColorsLight.medium);
      expect(getSeverityColorLight('low')).toBe(SeverityColorsLight.low);
      expect(getSeverityColorLight('note')).toBe(SeverityColorsLight.note);
    });

    it('is case insensitive', () => {
      expect(getSeverityColorLight('CRITICAL')).toBe(SeverityColorsLight.critical);
      expect(getSeverityColorLight('High')).toBe(SeverityColorsLight.high);
    });

    it('returns fallback for null/undefined', () => {
      expect(getSeverityColorLight(null)).toBe('#9e9e9e20');
      expect(getSeverityColorLight(undefined)).toBe('#9e9e9e20');
    });

    it('returns fallback for unknown severity', () => {
      expect(getSeverityColorLight('invalid')).toBe('#9e9e9e20');
    });

    it('accepts custom fallback color', () => {
      expect(getSeverityColorLight(null, '#ff000020')).toBe('#ff000020');
    });
  });

  describe('getSeverityTextColor', () => {
    describe('light mode', () => {
      it('returns correct text color for each severity', () => {
        expect(getSeverityTextColor('critical', false)).toBe(SeverityTextColorsLight.critical);
        expect(getSeverityTextColor('high', false)).toBe(SeverityTextColorsLight.high);
        expect(getSeverityTextColor('medium', false)).toBe(SeverityTextColorsLight.medium);
        expect(getSeverityTextColor('low', false)).toBe(SeverityTextColorsLight.low);
        expect(getSeverityTextColor('note', false)).toBe(SeverityTextColorsLight.note);
      });
    });

    describe('dark mode', () => {
      it('returns correct text color for each severity', () => {
        expect(getSeverityTextColor('critical', true)).toBe(SeverityTextColorsDark.critical);
        expect(getSeverityTextColor('high', true)).toBe(SeverityTextColorsDark.high);
        expect(getSeverityTextColor('medium', true)).toBe(SeverityTextColorsDark.medium);
        expect(getSeverityTextColor('low', true)).toBe(SeverityTextColorsDark.low);
        expect(getSeverityTextColor('note', true)).toBe(SeverityTextColorsDark.note);
      });
    });

    it('defaults to light mode when isDarkMode not specified', () => {
      expect(getSeverityTextColor('critical')).toBe(SeverityTextColorsLight.critical);
    });

    it('returns fallback for null/undefined severity', () => {
      expect(getSeverityTextColor(null)).toBe('#6B7280');
      expect(getSeverityTextColor(undefined)).toBe('#6B7280');
    });

    it('accepts custom fallback color', () => {
      expect(getSeverityTextColor(null, false, '#123456')).toBe('#123456');
    });

    it('is case insensitive', () => {
      expect(getSeverityTextColor('CRITICAL', false)).toBe(SeverityTextColorsLight.critical);
      expect(getSeverityTextColor('High', true)).toBe(SeverityTextColorsDark.high);
    });
  });

  describe('isValidSeverity', () => {
    it('returns true for valid severity levels', () => {
      expect(isValidSeverity('critical')).toBe(true);
      expect(isValidSeverity('high')).toBe(true);
      expect(isValidSeverity('medium')).toBe(true);
      expect(isValidSeverity('low')).toBe(true);
      expect(isValidSeverity('note')).toBe(true);
    });

    it('returns true for uppercase severity levels', () => {
      expect(isValidSeverity('CRITICAL')).toBe(true);
      expect(isValidSeverity('HIGH')).toBe(true);
      expect(isValidSeverity('MEDIUM')).toBe(true);
      expect(isValidSeverity('LOW')).toBe(true);
      expect(isValidSeverity('NOTE')).toBe(true);
    });

    it('returns true for mixed case severity levels', () => {
      expect(isValidSeverity('Critical')).toBe(true);
      expect(isValidSeverity('High')).toBe(true);
    });

    it('returns false for invalid severity levels', () => {
      expect(isValidSeverity('invalid')).toBe(false);
      expect(isValidSeverity('severe')).toBe(false);
      expect(isValidSeverity('info')).toBe(false);
      expect(isValidSeverity('warning')).toBe(false);
      expect(isValidSeverity('')).toBe(false);
    });

    it('provides type guard functionality', () => {
      const severity = 'high';
      if (isValidSeverity(severity)) {
        // TypeScript should recognize severity as SeverityLevel here
        const level: SeverityLevel = severity.toLowerCase() as SeverityLevel;
        expect(level).toBe('high');
      }
    });
  });

  describe('SeverityColors accessibility', () => {
    it('has all five severity levels defined', () => {
      expect(SeverityColors).toHaveProperty('critical');
      expect(SeverityColors).toHaveProperty('high');
      expect(SeverityColors).toHaveProperty('medium');
      expect(SeverityColors).toHaveProperty('low');
      expect(SeverityColors).toHaveProperty('note');
    });

    it('colors are valid hex codes', () => {
      // SeverityColors include alpha channel (8 hex digits)
      const hexRegex = /^#[0-9A-Fa-f]{6,8}$/;
      expect(SeverityColors.critical).toMatch(hexRegex);
      expect(SeverityColors.high).toMatch(hexRegex);
      expect(SeverityColors.medium).toMatch(hexRegex);
      expect(SeverityColors.low).toMatch(hexRegex);
      expect(SeverityColors.note).toMatch(hexRegex);
    });

    it('light colors include alpha channel', () => {
      const hexWithAlphaRegex = /^#[0-9A-Fa-f]{8}$/;
      expect(SeverityColorsLight.critical).toMatch(hexWithAlphaRegex);
      expect(SeverityColorsLight.high).toMatch(hexWithAlphaRegex);
      expect(SeverityColorsLight.medium).toMatch(hexWithAlphaRegex);
      expect(SeverityColorsLight.low).toMatch(hexWithAlphaRegex);
      expect(SeverityColorsLight.note).toMatch(hexWithAlphaRegex);
    });
  });
});
