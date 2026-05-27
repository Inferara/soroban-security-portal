import { describe, it, expect } from 'vitest';
import { highlightMentions } from '../mentions';

describe('highlightMentions', () => {
  it('bolds a mention at the start of the string', () => {
    expect(highlightMentions('@alice hi')).toBe('**@alice** hi');
  });
  it('bolds a mention after whitespace and keeps the separator', () => {
    expect(highlightMentions('hi @bob there')).toBe('hi **@bob** there');
  });
  it('bolds multiple mentions', () => {
    expect(highlightMentions('@a and @b')).toBe('**@a** and **@b**');
  });
  it('supports underscores, digits, dots and hyphens in usernames', () => {
    expect(highlightMentions('ping @user_1.x-y')).toBe('ping **@user_1.x-y**');
  });
  it('leaves text without mentions unchanged', () => {
    expect(highlightMentions('no mention here')).toBe('no mention here');
  });
  it('does not treat an email local part as a mention', () => {
    expect(highlightMentions('mail me a@b.com')).toBe('mail me a@b.com');
  });
  it('returns empty string for empty input', () => {
    expect(highlightMentions('')).toBe('');
  });
});
