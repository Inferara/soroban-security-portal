import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ThemeProvider } from '../../../contexts/ThemeContext';
import { CosmicSurface } from '../CosmicSurface';

describe('CosmicSurface', () => {
  it('renders children', () => {
    render(
      <ThemeProvider>
        <CosmicSurface><span>hello surface</span></CosmicSurface>
      </ThemeProvider>,
    );
    expect(screen.getByText('hello surface')).toBeInTheDocument();
  });
});
