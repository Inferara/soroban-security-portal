import { describe, it, expect } from 'vitest';
import { CosmicTokens, DaylightTokens, getThemeTokens } from '../tokens';

describe('theme tokens', () => {
  it('exposes cosmic + daylight token sets with the same keys', () => {
    expect(Object.keys(CosmicTokens).sort()).toEqual(Object.keys(DaylightTokens).sort());
  });
  it('returns cosmic tokens for dark and daylight for light', () => {
    expect(getThemeTokens('dark')).toBe(CosmicTokens);
    expect(getThemeTokens('light')).toBe(DaylightTokens);
  });
  it('keeps brand accent colors', () => {
    expect(CosmicTokens.accentGold).toBe('#FFD84D');
    expect(CosmicTokens.accentBlue).toBe('#2D4EFF');
  });
});
