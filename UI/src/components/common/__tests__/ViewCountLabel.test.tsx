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

  it('shows both today and total view counts', () => {
    renderWith(<ViewCountLabel count={{ total: 1234, today: 12, unique: 980 }} />);
    expect(screen.getByText('12 today · 1234 total')).toBeInTheDocument();
  });
});
