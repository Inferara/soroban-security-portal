import { describe, it, expect } from 'vitest';
import { getUserInitials } from '../user-utils';

describe('user-utils', () => {
  describe('getUserInitials', () => {
    it('extracts initials from two-word name', () => {
      expect(getUserInitials('John Doe')).toBe('JD');
      expect(getUserInitials('Jane Smith')).toBe('JS');
      expect(getUserInitials('Alice Bob')).toBe('AB');
    });

    it('extracts initials from single-word name', () => {
      expect(getUserInitials('John')).toBe('J');
      expect(getUserInitials('Alice')).toBe('A');
    });

    it('extracts first two initials from three-word name', () => {
      expect(getUserInitials('John Michael Doe')).toBe('JM');
      expect(getUserInitials('Mary Jane Watson')).toBe('MJ');
    });

    it('extracts first two initials from many-word name', () => {
      expect(getUserInitials('John Michael Doe Smith')).toBe('JM');
      expect(getUserInitials('A B C D E F')).toBe('AB');
    });

    it('returns uppercase initials', () => {
      expect(getUserInitials('john doe')).toBe('JD');
      expect(getUserInitials('jane smith')).toBe('JS');
      expect(getUserInitials('ALICE BOB')).toBe('AB');
    });

    it('handles mixed case names', () => {
      expect(getUserInitials('jOhN dOe')).toBe('JD');
      expect(getUserInitials('JaNe SmItH')).toBe('JS');
    });

    it('handles names with extra spaces', () => {
      expect(getUserInitials('John  Doe')).toBe('JD');
      expect(getUserInitials('  John Doe  ')).toBe('JD');
    });

    it('handles empty string', () => {
      expect(getUserInitials('')).toBe('');
    });

    it('handles single character name', () => {
      expect(getUserInitials('A')).toBe('A');
    });

    it('handles names with hyphens as single words', () => {
      // Hyphenated names are treated as single words
      expect(getUserInitials('Mary-Jane Watson')).toBe('MW');
    });

    it('handles names with apostrophes', () => {
      expect(getUserInitials("O'Brien Smith")).toBe('OS');
    });

    it('handles international characters', () => {
      expect(getUserInitials('José García')).toBe('JG');
      expect(getUserInitials('François Müller')).toBe('FM');
      expect(getUserInitials('北 京')).toBe('北京');
    });

    it('handles typical user display names', () => {
      expect(getUserInitials('Test User')).toBe('TU');
      expect(getUserInitials('Admin')).toBe('A');
      expect(getUserInitials('System Administrator')).toBe('SA');
    });

    it('handles email-like names', () => {
      // If someone's name field contains just an email
      expect(getUserInitials('user@example.com')).toBe('U');
    });

    it('handles numbers in names', () => {
      expect(getUserInitials('User123 Test')).toBe('UT');
      expect(getUserInitials('123 Test')).toBe('1T');
    });
  });
});
