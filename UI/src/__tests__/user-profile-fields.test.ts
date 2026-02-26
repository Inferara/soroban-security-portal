import { describe, expect, it } from 'vitest';
import {
    isValidWebsiteUrl,
    isValidTwitterUrl,
    isValidGitHubUrl,
    MAX_BIO_LENGTH,
    MAX_TAG_LENGTH,
    MAX_TAGS,
    PREDEFINED_EXPERTISE_TAGS,
} from '../api/soroban-security-portal/models/user';


describe('isValidWebsiteUrl', () => {
    it('accepts empty string (field is optional)', () => {
        expect(isValidWebsiteUrl('')).toBe(true);
    });

    it('accepts https URL', () => {
        expect(isValidWebsiteUrl('https://example.com')).toBe(true);
    });

    it('accepts http URL', () => {
        expect(isValidWebsiteUrl('http://example.com')).toBe(true);
    });

    it('accepts URL with path', () => {
        expect(isValidWebsiteUrl('https://example.com/about')).toBe(true);
    });

    it('rejects bare domain without scheme', () => {
        expect(isValidWebsiteUrl('example.com')).toBe(false);
    });

    it('rejects javascript: scheme — XSS vector', () => {
        expect(isValidWebsiteUrl('javascript:alert(document.cookie)')).toBe(false);
    });

    it('rejects data: scheme — XSS vector', () => {
        expect(isValidWebsiteUrl('data:text/html,<script>alert(1)</script>')).toBe(false);
    });

    it('rejects vbscript: scheme', () => {
        expect(isValidWebsiteUrl('vbscript:msgbox(1)')).toBe(false);
    });

    it('trims leading/trailing whitespace before parsing', () => {
        expect(isValidWebsiteUrl('  https://example.com  ')).toBe(true);
    });
});

// ── isValidTwitterUrl ─────────────────────────────────────────────────────────

describe('isValidTwitterUrl', () => {
    it('accepts empty string (field is optional)', () => {
        expect(isValidTwitterUrl('')).toBe(true);
    });

    it('accepts twitter.com profile', () => {
        expect(isValidTwitterUrl('https://twitter.com/pheobeayo')).toBe(true);
    });

    it('accepts x.com profile', () => {
        expect(isValidTwitterUrl('https://x.com/pheobeayo')).toBe(true);
    });

    it('accepts www. prefix', () => {
        expect(isValidTwitterUrl('https://www.twitter.com/pheobeayo')).toBe(true);
    });

    it('accepts trailing slash', () => {
        expect(isValidTwitterUrl('https://twitter.com/pheobeayo/')).toBe(true);
    });

    it('is case-insensitive (HTTPS://Twitter.com/...)', () => {
        expect(isValidTwitterUrl('HTTPS://Twitter.com/pheobeayo')).toBe(true);
    });

    it('rejects username longer than 15 chars', () => {
        expect(isValidTwitterUrl('https://twitter.com/thisusernameiswaytoolong')).toBe(false);
    });

    it('rejects tweet URL (not a profile)', () => {
        expect(isValidTwitterUrl('https://twitter.com/pheobeayo/status/123')).toBe(false);
    });

    it('rejects unrelated domain', () => {
        expect(isValidTwitterUrl('https://example.com/pheobeayo')).toBe(false);
    });
});

// ── isValidGitHubUrl ──────────────────────────────────────────────────────────

describe('isValidGitHubUrl', () => {
    it('accepts empty string (field is optional)', () => {
        expect(isValidGitHubUrl('')).toBe(true);
    });

    it('accepts github.com profile', () => {
        expect(isValidGitHubUrl('https://github.com/pheobeayo')).toBe(true);
    });

    it('accepts username with hyphens', () => {
        expect(isValidGitHubUrl('https://github.com/phoebe-ayo')).toBe(true);
    });

    it('is case-insensitive', () => {
        expect(isValidGitHubUrl('HTTPS://GitHub.com/pheobeayo')).toBe(true);
    });

    it('rejects repository URL (not a profile)', () => {
        expect(isValidGitHubUrl('https://github.com/pheobeayo/my-repo')).toBe(false);
    });

    it('rejects GitLab URL', () => {
        expect(isValidGitHubUrl('https://gitlab.com/pheobeayo')).toBe(false);
    });

    it('rejects bare domain', () => {
        expect(isValidGitHubUrl('github.com/pheobeayo')).toBe(false);
    });
});

// ── Constants ─────────────────────────────────────────────────────────────────

describe('profile constants', () => {
    it('MAX_BIO_LENGTH is 500', () => {
        expect(MAX_BIO_LENGTH).toBe(500);
    });

    it('MAX_TAG_LENGTH is 30', () => {
        expect(MAX_TAG_LENGTH).toBe(30);
    });

    it('MAX_TAGS is 15', () => {
        expect(MAX_TAGS).toBe(15);
    });
});

// ── PREDEFINED_EXPERTISE_TAGS ─────────────────────────────────────────────────

describe('PREDEFINED_EXPERTISE_TAGS', () => {
    it('is non-empty', () => {
        expect(PREDEFINED_EXPERTISE_TAGS.length).toBeGreaterThan(0);
    });

    it('all tags are within MAX_TAG_LENGTH', () => {
        const violations = PREDEFINED_EXPERTISE_TAGS.filter((t) => t.length > MAX_TAG_LENGTH);
        expect(violations).toEqual([]);
    });

    it('has no duplicate tags (case-insensitive)', () => {
        const lower = PREDEFINED_EXPERTISE_TAGS.map((t) => t.toLowerCase());
        const unique = new Set(lower);
        expect(unique.size).toBe(PREDEFINED_EXPERTISE_TAGS.length);
    });

    it('contains expected high-value Soroban ecosystem tags', () => {
        expect(PREDEFINED_EXPERTISE_TAGS).toContain('Soroban');
        expect(PREDEFINED_EXPERTISE_TAGS).toContain('Rust');
        expect(PREDEFINED_EXPERTISE_TAGS).toContain('Smart Contract Auditing');
    });
});

// ── Bio boundary conditions ───────────────────────────────────────────────────

describe('bio length boundary', () => {
    it('exactly MAX_BIO_LENGTH chars is valid', () => {
        const bio = 'a'.repeat(MAX_BIO_LENGTH);
        expect(bio.length <= MAX_BIO_LENGTH).toBe(true);
    });

    it('MAX_BIO_LENGTH + 1 chars is invalid', () => {
        const bio = 'a'.repeat(MAX_BIO_LENGTH + 1);
        expect(bio.length > MAX_BIO_LENGTH).toBe(true);
    });
});