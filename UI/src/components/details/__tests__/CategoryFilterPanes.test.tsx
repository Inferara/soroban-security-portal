import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { CategoryFilterPanes } from '../CategoryFilterPanes';
import { VulnerabilityCategory } from '../../../api/soroban-security-portal/models/vulnerability';

const theme = createTheme();

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <ThemeProvider theme={theme}>{children}</ThemeProvider>
);

const sampleData = [
  {
    id: VulnerabilityCategory.Valid,
    value: 2,
    label: 'Valid (Fixed)',
    color: '#2e7d32',
  },
  {
    id: VulnerabilityCategory.ValidNotFixed,
    value: 1,
    label: 'Valid (Not Fixed)',
    color: '#c62828',
  },
];

describe('CategoryFilterPanes', () => {
  it('calls onCategorySelect with category id when a pane is clicked', () => {
    const onCategorySelect = vi.fn();
    render(
      <CategoryFilterPanes
        data={sampleData}
        selectedCategoryId={null}
        onCategorySelect={onCategorySelect}
      />,
      { wrapper }
    );

    fireEvent.click(screen.getByRole('button', { name: /Valid \(Fixed\)/i }));
    expect(onCategorySelect).toHaveBeenCalledWith(VulnerabilityCategory.Valid);
  });

  it('clears selection when the active pane is clicked again', () => {
    const onCategorySelect = vi.fn();
    render(
      <CategoryFilterPanes
        data={sampleData}
        selectedCategoryId={VulnerabilityCategory.ValidNotFixed}
        onCategorySelect={onCategorySelect}
      />,
      { wrapper }
    );

    fireEvent.click(screen.getByRole('button', { name: /Valid \(Not Fixed\)/i }));
    expect(onCategorySelect).toHaveBeenCalledWith(null);
  });
});
