import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RevealOnScroll } from '../RevealOnScroll';

class IO {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}

describe('RevealOnScroll', () => {
  it('renders children even before intersection', () => {
    // @ts-expect-error test stub
    window.IntersectionObserver = IO;
    render(<RevealOnScroll><p>revealed content</p></RevealOnScroll>);
    expect(screen.getByText('revealed content')).toBeInTheDocument();
  });
});
