import { describe, it, expect } from 'vitest';
import { GITHUB_URL_REGEX, X_URL_REGEX, getSafePreviewUrl } from '../edit-profile';
import { getSafeSocialUrl } from '../profile';

describe('Social Linking URL Validation', () => {
  describe('GitHub URL validation', () => {
    it('accepts valid GitHub profile URLs with https', () => {
      expect(GITHUB_URL_REGEX.test('https://github.com/alice')).toBe(true);
      expect(GITHUB_URL_REGEX.test('https://www.github.com/alice-dev')).toBe(true);
      expect(GITHUB_URL_REGEX.test('https://github.com/user123/')).toBe(true);
    });

    it('rejects insecure http schemes', () => {
      expect(GITHUB_URL_REGEX.test('http://github.com/alice')).toBe(false);
      expect(getSafePreviewUrl('GitHub', 'http://github.com/alice')).toBeNull();
      expect(getSafeSocialUrl('GitHub', 'http://github.com/alice')).toBeNull();
    });

    it('rejects foreign domains and javascript schemes', () => {
      expect(GITHUB_URL_REGEX.test('https://attacker.com/alice')).toBe(false);
      expect(GITHUB_URL_REGEX.test('javascript:alert(1)')).toBe(false);
      expect(getSafePreviewUrl('GitHub', 'javascript:alert(1)')).toBeNull();
      expect(getSafeSocialUrl('GitHub', 'javascript:alert(1)')).toBeNull();
    });
  });

  describe('X (Twitter) URL validation', () => {
    it('accepts valid x.com and twitter.com URLs with https', () => {
      expect(X_URL_REGEX.test('https://x.com/alice')).toBe(true);
      expect(X_URL_REGEX.test('https://twitter.com/alice_dev')).toBe(true);
      expect(X_URL_REGEX.test('https://www.x.com/user123/')).toBe(true);
    });

    it('rejects insecure http schemes', () => {
      expect(X_URL_REGEX.test('http://x.com/alice')).toBe(false);
      expect(getSafePreviewUrl('X', 'http://x.com/alice')).toBeNull();
      expect(getSafeSocialUrl('X', 'http://x.com/alice')).toBeNull();
    });

    it('rejects foreign domains and invalid usernames', () => {
      expect(X_URL_REGEX.test('https://facebook.com/alice')).toBe(false);
      expect(X_URL_REGEX.test('https://x.com/toolongusernameexceeding15chars')).toBe(false);
      expect(getSafePreviewUrl('X', 'https://malicious.org')).toBeNull();
      expect(getSafeSocialUrl('X', 'https://malicious.org')).toBeNull();
    });
  });

  describe('Safe preview and render functions', () => {
    it('returns normalized safe URL for valid inputs', () => {
      expect(getSafePreviewUrl('GitHub', 'https://github.com/torvalds')).toBe('https://github.com/torvalds');
      expect(getSafeSocialUrl('GitHub', 'https://github.com/torvalds')).toBe('https://github.com/torvalds');
      expect(getSafePreviewUrl('X', 'https://x.com/jack')).toBe('https://x.com/jack');
      expect(getSafeSocialUrl('X', 'https://x.com/jack')).toBe('https://x.com/jack');
    });

    it('returns null for empty, blank, or unsupported services', () => {
      expect(getSafePreviewUrl('GitHub', '')).toBeNull();
      expect(getSafeSocialUrl('GitHub', '   ')).toBeNull();
      expect(getSafePreviewUrl('Unknown', 'https://example.com')).toBeNull();
      expect(getSafeSocialUrl('Google', 'user@gmail.com')).toBeNull();
    });
  });
});
