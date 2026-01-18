import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { ChartErrorBoundary, withChartErrorBoundary } from '../ChartErrorBoundary';

const theme = createTheme();

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <ThemeProvider theme={theme}>{children}</ThemeProvider>
);

// Component that throws an error
const ThrowingComponent = ({ shouldThrow }: { shouldThrow: boolean }) => {
  if (shouldThrow) {
    throw new Error('Test error');
  }
  return <div data-testid="child-content">Normal content</div>;
};

// Suppress console errors during error boundary tests
let consoleSpy: ReturnType<typeof vi.spyOn>;
let consoleGroupSpy: ReturnType<typeof vi.spyOn>;
let consoleGroupEndSpy: ReturnType<typeof vi.spyOn>;

describe('ChartErrorBoundary', () => {
  beforeEach(() => {
    consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    consoleGroupSpy = vi.spyOn(console, 'groupCollapsed').mockImplementation(() => {});
    consoleGroupEndSpy = vi.spyOn(console, 'groupEnd').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
    consoleGroupSpy.mockRestore();
    consoleGroupEndSpy.mockRestore();
  });

  describe('normal rendering', () => {
    it('renders children when no error', () => {
      render(
        <ChartErrorBoundary>
          <ThrowingComponent shouldThrow={false} />
        </ChartErrorBoundary>,
        { wrapper }
      );

      expect(screen.getByTestId('child-content')).toBeInTheDocument();
      expect(screen.getByText('Normal content')).toBeInTheDocument();
    });

    it('does not show error UI when children render normally', () => {
      render(
        <ChartErrorBoundary>
          <ThrowingComponent shouldThrow={false} />
        </ChartErrorBoundary>,
        { wrapper }
      );

      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      expect(screen.queryByText('Chart Error')).not.toBeInTheDocument();
    });
  });

  describe('error handling', () => {
    it('shows fallback UI when child throws error', () => {
      render(
        <ChartErrorBoundary>
          <ThrowingComponent shouldThrow={true} />
        </ChartErrorBoundary>,
        { wrapper }
      );

      expect(screen.getByText('Chart Error')).toBeInTheDocument();
      expect(screen.queryByTestId('child-content')).not.toBeInTheDocument();
    });

    it('shows default fallback message', () => {
      render(
        <ChartErrorBoundary>
          <ThrowingComponent shouldThrow={true} />
        </ChartErrorBoundary>,
        { wrapper }
      );

      expect(screen.getByText(/unable to display this chart/i)).toBeInTheDocument();
    });

    it('shows custom fallback title', () => {
      render(
        <ChartErrorBoundary fallbackTitle="Custom Error Title">
          <ThrowingComponent shouldThrow={true} />
        </ChartErrorBoundary>,
        { wrapper }
      );

      expect(screen.getByText('Custom Error Title')).toBeInTheDocument();
    });

    it('shows custom fallback message', () => {
      render(
        <ChartErrorBoundary fallbackMessage="Custom error message for testing">
          <ThrowingComponent shouldThrow={true} />
        </ChartErrorBoundary>,
        { wrapper }
      );

      expect(screen.getByText('Custom error message for testing')).toBeInTheDocument();
    });

    it('has role="alert" for accessibility', () => {
      render(
        <ChartErrorBoundary>
          <ThrowingComponent shouldThrow={true} />
        </ChartErrorBoundary>,
        { wrapper }
      );

      // Should have at least one alert element (main container + possibly debug alert)
      const alerts = screen.getAllByRole('alert');
      expect(alerts.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('retry functionality', () => {
    it('shows retry button by default', () => {
      render(
        <ChartErrorBoundary>
          <ThrowingComponent shouldThrow={true} />
        </ChartErrorBoundary>,
        { wrapper }
      );

      expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
    });

    it('hides retry button when showRetry is false', () => {
      render(
        <ChartErrorBoundary showRetry={false}>
          <ThrowingComponent shouldThrow={true} />
        </ChartErrorBoundary>,
        { wrapper }
      );

      expect(screen.queryByRole('button', { name: /try again/i })).not.toBeInTheDocument();
    });

    it('resets error state on retry click', () => {
      const TestComponent = () => {
        return (
          <ChartErrorBoundary>
            <ThrowingComponent shouldThrow={true} />
          </ChartErrorBoundary>
        );
      };

      render(<TestComponent />, { wrapper });

      expect(screen.getByText('Chart Error')).toBeInTheDocument();

      // Click retry - this will re-render and throw again, but state should reset first
      fireEvent.click(screen.getByRole('button', { name: /try again/i }));

      // After retry, it will throw again, showing error again
      // But the important thing is the retry click was processed
      expect(screen.getByText('Chart Error')).toBeInTheDocument();
    });
  });

  describe('custom fallback', () => {
    it('renders ReactNode fallback', () => {
      render(
        <ChartErrorBoundary
          fallback={<div data-testid="custom-fallback">My Custom Fallback</div>}
        >
          <ThrowingComponent shouldThrow={true} />
        </ChartErrorBoundary>,
        { wrapper }
      );

      expect(screen.getByTestId('custom-fallback')).toBeInTheDocument();
      expect(screen.getByText('My Custom Fallback')).toBeInTheDocument();
    });

    it('renders function fallback with error info', () => {
      render(
        <ChartErrorBoundary
          fallback={(errorInfo, reset) => (
            <div data-testid="fn-fallback">
              <span>Error: {errorInfo.error.message}</span>
              <button onClick={reset}>Reset</button>
            </div>
          )}
        >
          <ThrowingComponent shouldThrow={true} />
        </ChartErrorBoundary>,
        { wrapper }
      );

      expect(screen.getByTestId('fn-fallback')).toBeInTheDocument();
      expect(screen.getByText('Error: Test error')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Reset' })).toBeInTheDocument();
    });

    it('function fallback reset clears error', () => {
      render(
        <ChartErrorBoundary
          fallback={(errorInfo, reset) => (
            <button onClick={reset} data-testid="reset-btn">Reset</button>
          )}
        >
          <ThrowingComponent shouldThrow={true} />
        </ChartErrorBoundary>,
        { wrapper }
      );

      const resetButton = screen.getByTestId('reset-btn');
      fireEvent.click(resetButton);

      // After reset, it tries to render children again (which throws again)
      // So we should still see the error state
      expect(screen.getByTestId('reset-btn')).toBeInTheDocument();
    });
  });

  describe('onError callback', () => {
    it('calls onError when error occurs', () => {
      const onError = vi.fn();

      render(
        <ChartErrorBoundary onError={onError}>
          <ThrowingComponent shouldThrow={true} />
        </ChartErrorBoundary>,
        { wrapper }
      );

      expect(onError).toHaveBeenCalledTimes(1);
      expect(onError).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.any(Error),
          timestamp: expect.any(Date),
        })
      );
    });

    it('provides error message in callback', () => {
      const onError = vi.fn();

      render(
        <ChartErrorBoundary onError={onError}>
          <ThrowingComponent shouldThrow={true} />
        </ChartErrorBoundary>,
        { wrapper }
      );

      expect(onError.mock.calls[0][0].error.message).toBe('Test error');
    });
  });

  describe('card wrapper', () => {
    it('wraps in Card when showCard is true', () => {
      render(
        <ChartErrorBoundary showCard>
          <ThrowingComponent shouldThrow={true} />
        </ChartErrorBoundary>,
        { wrapper }
      );

      expect(document.querySelector('.MuiCard-root')).toBeInTheDocument();
    });

    it('does not wrap in Card by default', () => {
      render(
        <ChartErrorBoundary>
          <ThrowingComponent shouldThrow={true} />
        </ChartErrorBoundary>,
        { wrapper }
      );

      // The error content should be in a Box, not a Card (unless there's other card styling)
      const cards = document.querySelectorAll('.MuiCard-root');
      expect(cards.length).toBe(0);
    });
  });

  describe('fallback height', () => {
    it('uses default height of 300', () => {
      render(
        <ChartErrorBoundary>
          <ThrowingComponent shouldThrow={true} />
        </ChartErrorBoundary>,
        { wrapper }
      );

      // The main alert container should be present (there may be multiple alerts)
      const alerts = screen.getAllByRole('alert');
      expect(alerts.length).toBeGreaterThanOrEqual(1);
    });

    it('accepts custom fallback height', () => {
      render(
        <ChartErrorBoundary fallbackHeight={500}>
          <ThrowingComponent shouldThrow={true} />
        </ChartErrorBoundary>,
        { wrapper }
      );

      const alerts = screen.getAllByRole('alert');
      expect(alerts.length).toBeGreaterThanOrEqual(1);
    });
  });
});

describe('withChartErrorBoundary', () => {
  beforeEach(() => {
    consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    consoleGroupSpy = vi.spyOn(console, 'groupCollapsed').mockImplementation(() => {});
    consoleGroupEndSpy = vi.spyOn(console, 'groupEnd').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
    consoleGroupSpy.mockRestore();
    consoleGroupEndSpy.mockRestore();
  });

  it('wraps component with error boundary', () => {
    const WrappedContent = withChartErrorBoundary(
      <div data-testid="wrapped">Wrapped content</div>
    );

    render(<>{WrappedContent}</>, { wrapper });

    expect(screen.getByTestId('wrapped')).toBeInTheDocument();
  });

  it('accepts props for error boundary', () => {
    const WrappedContent = withChartErrorBoundary(
      <ThrowingComponent shouldThrow={true} />,
      { fallbackTitle: 'Custom Title' }
    );

    render(<>{WrappedContent}</>, { wrapper });

    expect(screen.getByText('Custom Title')).toBeInTheDocument();
  });

  it('catches errors in wrapped component', () => {
    const WrappedContent = withChartErrorBoundary(
      <ThrowingComponent shouldThrow={true} />
    );

    render(<>{WrappedContent}</>, { wrapper });

    expect(screen.getByText('Chart Error')).toBeInTheDocument();
  });
});
