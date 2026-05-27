import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { ViewCountLabel } from '../ViewCountLabel';

const renderWith = (ui: React.ReactNode) =>
  render(<ThemeProvider theme={createTheme()}>{ui}</ThemeProvider>);

describe('ViewCountLabel', () => {
  it('renders nothing while the count is still loading (null)', () => {
    const { container } = renderWith(<ViewCountLabel count={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders the total view count (plural)', () => {
    renderWith(<ViewCountLabel count={{ total: 1234, unique: 980 }} />);
    expect(screen.getByText('1234 views')).toBeInTheDocument();
  });

  it('uses the singular form for a single view', () => {
    renderWith(<ViewCountLabel count={{ total: 1, unique: 1 }} />);
    expect(screen.getByText('1 view')).toBeInTheDocument();
  });
});
