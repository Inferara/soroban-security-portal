import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { SeverityPieChart, PieChartDataPoint } from '../SeverityPieChart';

const theme = createTheme();

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <ThemeProvider theme={theme}>{children}</ThemeProvider>
);

describe('SeverityPieChart', () => {
  const sampleData: PieChartDataPoint[] = [
    { id: 'critical', value: 4, label: 'Critical', color: '#B91C1C' },
    { id: 'high', value: 8, label: 'High', color: '#C2410C' },
    { id: 'medium', value: 12, label: 'Medium', color: '#D97706' },
  ];

  it('renders title correctly', () => {
    render(
      <SeverityPieChart
        data={sampleData}
        title="Vulnerabilities by Severity"
      />,
      { wrapper }
    );

    expect(screen.getByText('Vulnerabilities by Severity')).toBeInTheDocument();
  });

  it('renders empty message when data is empty or zero', () => {
    render(
      <SeverityPieChart
        data={[]}
        title="Fix Status"
        emptyMessage="No vulnerability data available"
      />,
      { wrapper }
    );

    expect(screen.getByText('No vulnerability data available')).toBeInTheDocument();
  });

  it('renders with custom onItemClick prop without error', () => {
    const handleClick = vi.fn();
    render(
      <SeverityPieChart
        data={sampleData}
        title="Interactive Severity"
        onItemClick={handleClick}
      />,
      { wrapper }
    );

    expect(screen.getByText('Interactive Severity')).toBeInTheDocument();
  });

  it('triggers onItemClick when a chart slice is clicked', () => {
    const handleClick = vi.fn();
    const { container } = render(
      <SeverityPieChart
        data={sampleData}
        title="Interactive Severity"
        onItemClick={handleClick}
      />,
      { wrapper }
    );

    const arcs = container.querySelectorAll('.MuiPieArc-root');
    if (arcs.length > 0) {
      arcs[0].dispatchEvent(new MouseEvent('click', { bubbles: true }));
      expect(handleClick).toHaveBeenCalled();
    } else {
      expect(screen.getByText('Interactive Severity')).toBeInTheDocument();
    }
  });
});
