import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const file = readFileSync(resolve(__dirname, '..', 'main-window.tsx'), 'utf8');

describe('header redesign', () => {
  it('renders the Stellar brand text', () => {
    expect(file).toContain('Stellar');
    expect(file).toContain('Security Portal');
  });
  it('no longer hides the theme toggle', () => {
    expect(file).not.toContain("visibility: 'hidden'");
  });
});
