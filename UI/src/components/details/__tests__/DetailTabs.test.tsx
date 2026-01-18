import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { renderHook, act } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { Dashboard, Timeline, Description } from '@mui/icons-material';
import { DetailTabs, useDetailTabs, TabConfig } from '../DetailTabs';

const theme = createTheme();

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <ThemeProvider theme={theme}>{children}</ThemeProvider>
);

const defaultTabs: TabConfig[] = [
  { id: 'overview', label: 'Overview', icon: <Dashboard data-testid="icon-overview" /> },
  { id: 'activity', label: 'Activity', icon: <Timeline data-testid="icon-activity" /> },
  { id: 'details', label: 'Details', icon: <Description data-testid="icon-details" /> },
];

describe('DetailTabs', () => {
  describe('rendering', () => {
    it('renders all tabs', () => {
      render(<DetailTabs tabs={defaultTabs} />, { wrapper });

      expect(screen.getByRole('tab', { name: /overview/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /activity/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /details/i })).toBeInTheDocument();
    });

    it('renders tab icons', () => {
      render(<DetailTabs tabs={defaultTabs} />, { wrapper });

      expect(screen.getByTestId('icon-overview')).toBeInTheDocument();
      expect(screen.getByTestId('icon-activity')).toBeInTheDocument();
      expect(screen.getByTestId('icon-details')).toBeInTheDocument();
    });

    it('renders correct number of tabs', () => {
      render(<DetailTabs tabs={defaultTabs} />, { wrapper });

      const tabs = screen.getAllByRole('tab');
      expect(tabs).toHaveLength(3);
    });

    it('renders single tab', () => {
      const singleTab: TabConfig[] = [
        { id: 'only', label: 'Only Tab', icon: <Dashboard /> },
      ];

      render(<DetailTabs tabs={singleTab} />, { wrapper });

      expect(screen.getByRole('tab', { name: /only tab/i })).toBeInTheDocument();
    });
  });

  describe('controlled mode', () => {
    it('uses provided value', () => {
      render(
        <DetailTabs
          tabs={defaultTabs}
          value={1}
          onChange={vi.fn()}
        />,
        { wrapper }
      );

      const activityTab = screen.getByRole('tab', { name: /activity/i });
      expect(activityTab).toHaveAttribute('aria-selected', 'true');
    });

    it('calls onChange when tab is clicked', () => {
      const handleChange = vi.fn();

      render(
        <DetailTabs
          tabs={defaultTabs}
          value={0}
          onChange={handleChange}
        />,
        { wrapper }
      );

      fireEvent.click(screen.getByRole('tab', { name: /activity/i }));

      expect(handleChange).toHaveBeenCalledTimes(1);
      expect(handleChange).toHaveBeenCalledWith(expect.anything(), 1);
    });

    it('does not change tab without onChange handler calling back', () => {
      const handleChange = vi.fn(); // Does not update state

      render(
        <DetailTabs
          tabs={defaultTabs}
          value={0}
          onChange={handleChange}
        />,
        { wrapper }
      );

      fireEvent.click(screen.getByRole('tab', { name: /activity/i }));

      // Tab should still show first tab as selected since we control it
      const overviewTab = screen.getByRole('tab', { name: /overview/i });
      expect(overviewTab).toHaveAttribute('aria-selected', 'true');
    });
  });

  describe('uncontrolled mode', () => {
    it('defaults to first tab', () => {
      render(<DetailTabs tabs={defaultTabs} />, { wrapper });

      const overviewTab = screen.getByRole('tab', { name: /overview/i });
      expect(overviewTab).toHaveAttribute('aria-selected', 'true');
    });

    it('uses defaultTab when provided', () => {
      render(<DetailTabs tabs={defaultTabs} defaultTab={2} />, { wrapper });

      const detailsTab = screen.getByRole('tab', { name: /details/i });
      expect(detailsTab).toHaveAttribute('aria-selected', 'true');
    });

    it('changes tab on click in uncontrolled mode', () => {
      render(<DetailTabs tabs={defaultTabs} />, { wrapper });

      // Initially first tab is selected
      expect(screen.getByRole('tab', { name: /overview/i })).toHaveAttribute('aria-selected', 'true');

      // Click second tab
      fireEvent.click(screen.getByRole('tab', { name: /activity/i }));

      // Now second tab should be selected
      expect(screen.getByRole('tab', { name: /activity/i })).toHaveAttribute('aria-selected', 'true');
      expect(screen.getByRole('tab', { name: /overview/i })).toHaveAttribute('aria-selected', 'false');
    });
  });

  describe('accessibility', () => {
    it('has tablist role', () => {
      render(<DetailTabs tabs={defaultTabs} />, { wrapper });

      expect(screen.getByRole('tablist')).toBeInTheDocument();
    });

    it('has tab role for each tab', () => {
      render(<DetailTabs tabs={defaultTabs} />, { wrapper });

      const tabs = screen.getAllByRole('tab');
      expect(tabs).toHaveLength(3);
    });

    it('has correct aria-selected state', () => {
      render(<DetailTabs tabs={defaultTabs} value={1} onChange={vi.fn()} />, { wrapper });

      expect(screen.getByRole('tab', { name: /overview/i })).toHaveAttribute('aria-selected', 'false');
      expect(screen.getByRole('tab', { name: /activity/i })).toHaveAttribute('aria-selected', 'true');
      expect(screen.getByRole('tab', { name: /details/i })).toHaveAttribute('aria-selected', 'false');
    });
  });

  describe('keyboard navigation', () => {
    it('supports keyboard navigation between tabs', () => {
      render(<DetailTabs tabs={defaultTabs} />, { wrapper });

      const firstTab = screen.getByRole('tab', { name: /overview/i });
      firstTab.focus();

      // MUI Tabs should support arrow key navigation
      expect(document.activeElement).toBe(firstTab);
    });
  });
});

describe('useDetailTabs', () => {
  it('initializes with default tab value', () => {
    const { result } = renderHook(() => useDetailTabs(0));

    expect(result.current.tabValue).toBe(0);
  });

  it('initializes with custom default tab', () => {
    const { result } = renderHook(() => useDetailTabs(2));

    expect(result.current.tabValue).toBe(2);
  });

  it('updates tabValue when handleTabChange is called', () => {
    const { result } = renderHook(() => useDetailTabs(0));

    act(() => {
      result.current.handleTabChange({} as React.SyntheticEvent, 1);
    });

    expect(result.current.tabValue).toBe(1);
  });

  it('updates tabValue when setTabValue is called', () => {
    const { result } = renderHook(() => useDetailTabs(0));

    act(() => {
      result.current.setTabValue(2);
    });

    expect(result.current.tabValue).toBe(2);
  });

  it('provides tabProps for controlled mode', () => {
    const { result } = renderHook(() => useDetailTabs(0));

    expect(result.current.tabProps).toHaveProperty('value', 0);
    expect(result.current.tabProps).toHaveProperty('onChange');
  });

  it('tabProps.onChange updates the value', () => {
    const { result } = renderHook(() => useDetailTabs(0));

    act(() => {
      result.current.tabProps.onChange({} as React.SyntheticEvent, 1);
    });

    expect(result.current.tabValue).toBe(1);
    expect(result.current.tabProps.value).toBe(1);
  });

  it('works correctly with DetailTabs component', () => {
    const TestComponent = () => {
      const { tabValue, tabProps } = useDetailTabs(0);
      return (
        <div>
          <DetailTabs tabs={defaultTabs} {...tabProps} />
          <div data-testid="current-tab">{tabValue}</div>
        </div>
      );
    };

    render(<TestComponent />, { wrapper });

    expect(screen.getByTestId('current-tab')).toHaveTextContent('0');

    fireEvent.click(screen.getByRole('tab', { name: /activity/i }));

    expect(screen.getByTestId('current-tab')).toHaveTextContent('1');
  });
});
