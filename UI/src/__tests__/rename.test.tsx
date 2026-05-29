import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const read = (p: string) => readFileSync(resolve(__dirname, '..', '..', p), 'utf8');

describe('product rename to Stellar Security Portal', () => {
  it('hero shows the Stellar wordmark', () => {
    const home = read('src/features/pages/regular/home/home.tsx');
    expect(home).toContain('Stellar Security Portal');
    expect(home).not.toContain('SOROBAN SECURITY PORTAL');
    expect(home).not.toContain('Soroban Security Portal');
  });
  it('SeoHead uses the new product name', () => {
    const seo = read('src/components/common/SeoHead.tsx');
    expect(seo).toContain('Stellar Security Portal');
    expect(seo).not.toContain('Soroban Security Portal');
  });
  it('document.title is renamed', () => {
    expect(read('src/main.tsx')).toContain('document.title = "Stellar Security Portal"');
  });
});
