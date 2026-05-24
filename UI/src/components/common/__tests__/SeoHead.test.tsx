import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { SeoHead } from '../SeoHead';

describe('SeoHead', () => {
  it('renders og + twitter meta tags into the document head', async () => {
    render(<SeoHead title="Reentrancy" description="A bug" url="https://x/vulnerability/1" />);

    // React 19 hoists <title>/<meta> rendered anywhere into <head>.
    expect(document.querySelector('meta[property="og:title"]')?.getAttribute('content')).toBe('Reentrancy');
    expect(document.querySelector('meta[property="og:description"]')?.getAttribute('content')).toBe('A bug');
    expect(document.querySelector('meta[property="og:url"]')?.getAttribute('content')).toBe('https://x/vulnerability/1');
    expect(document.querySelector('meta[name="twitter:card"]')?.getAttribute('content')).toBe('summary_large_image');
    expect(document.title).toContain('Reentrancy');
  });
});
