import React, { Component, ReactNode } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Alert,
  AlertTitle,
} from '@mui/material';
import { ErrorOutline, Refresh } from '@mui/icons-material';

/**
 * Error information captured by the error boundary
 */
export interface ChartErrorInfo {
  /** The error that was thrown */
  error: Error;
  /** React component stack trace */
  componentStack: string;
  /** Timestamp when the error occurred */
  timestamp: Date;
}

/**
 * Props for ChartErrorBoundary component
 */
export interface ChartErrorBoundaryProps {
  /** Child components (typically chart components) */
  children: ReactNode;
  /** Title to display in fallback UI (default: "Chart Error") */
  fallbackTitle?: string;
  /** Message to display in fallback UI */
  fallbackMessage?: string;
  /** Whether to show the retry button (default: true) */
  showRetry?: boolean;
  /** Whether to show error details in development (default: true) */
  showErrorDetails?: boolean;
  /** Custom fallback component to render instead of default */
  fallback?: ReactNode | ((error: ChartErrorInfo, reset: () => void) => ReactNode);
  /** Callback when an error is caught */
  onError?: (errorInfo: ChartErrorInfo) => void;
  /** Height for the fallback container (default: 300) */
  fallbackHeight?: number;
  /** Whether to wrap in a Card (default: false) */
  showCard?: boolean;
}

/**
 * State for ChartErrorBoundary component
 */
interface ChartErrorBoundaryState {
  hasError: boolean;
  errorInfo: ChartErrorInfo | null;
}

/**
 * ChartErrorBoundary - An error boundary specifically designed for chart components.
 *
 * Catches rendering errors in MUI X Charts (PieChart, LineChart, BarChart, etc.)
 * and displays a friendly fallback UI instead of crashing the entire page.
 *
 * Error boundaries are required to be class components in React as they need
 * the `componentDidCatch` and `getDerivedStateFromError` lifecycle methods.
 *
 * @example Basic usage wrapping a PieChart:
 * ```tsx
 * <ChartErrorBoundary>
 *   <PieChart
 *     series={[{ data: chartData }]}
 *     width={300}
 *     height={300}
 *   />
 * </ChartErrorBoundary>
 * ```
 *
 * @example With custom fallback message:
 * ```tsx
 * <ChartErrorBoundary
 *   fallbackTitle="Unable to Load Chart"
 *   fallbackMessage="The severity breakdown chart could not be rendered."
 *   onError={(errorInfo) => logToService(errorInfo)}
 * >
 *   <SeverityPieChart data={data} title="Severity" />
 * </ChartErrorBoundary>
 * ```
 *
 * @example With custom fallback component:
 * ```tsx
 * <ChartErrorBoundary
 *   fallback={(error, reset) => (
 *     <Box sx={{ textAlign: 'center', p: 4 }}>
 *       <Typography color="error">Chart failed to load</Typography>
 *       <Button onClick={reset}>Try Again</Button>
 *     </Box>
 *   )}
 * >
 *   <LineChart {...props} />
 * </ChartErrorBoundary>
 * ```
 *
 * @example Wrapping multiple charts:
 * ```tsx
 * <Grid container spacing={2}>
 *   <Grid item xs={6}>
 *     <ChartErrorBoundary showCard>
 *       <SeverityPieChart data={severityData} title="Severity" />
 *     </ChartErrorBoundary>
 *   </Grid>
 *   <Grid item xs={6}>
 *     <ChartErrorBoundary showCard>
 *       <SeverityPieChart data={categoryData} title="Categories" />
 *     </ChartErrorBoundary>
 *   </Grid>
 * </Grid>
 * ```
 */
export class ChartErrorBoundary extends Component<
  ChartErrorBoundaryProps,
  ChartErrorBoundaryState
> {
  constructor(props: ChartErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      errorInfo: null,
    };
  }

  /**
   * Update state when an error is caught during rendering
   */
  static getDerivedStateFromError(error: Error): Partial<ChartErrorBoundaryState> {
    return {
      hasError: true,
      errorInfo: {
        error,
        componentStack: '',
        timestamp: new Date(),
      },
    };
  }

  /**
   * Log the error and call the onError callback
   */
  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    const chartError: ChartErrorInfo = {
      error,
      componentStack: errorInfo.componentStack || '',
      timestamp: new Date(),
    };

    // Update state with complete error info
    this.setState({ errorInfo: chartError });

    // Log error for debugging
    this.logError(chartError);

    // Call the onError callback if provided
    if (this.props.onError) {
      this.props.onError(chartError);
    }
  }

  /**
   * Log error information to console in a structured format
   */
  private logError(errorInfo: ChartErrorInfo): void {
    if (import.meta.env.DEV) {
      console.groupCollapsed(
        '%c Chart Error Boundary ',
        'background: #d32f2f; color: white; padding: 2px 6px; border-radius: 4px;'
      );
      console.error('Error:', errorInfo.error);
      console.error('Message:', errorInfo.error.message);
      console.error('Stack:', errorInfo.error.stack);
      console.error('Component Stack:', errorInfo.componentStack);
      console.error('Timestamp:', errorInfo.timestamp.toISOString());
      console.groupEnd();
    } else {
      // In production, log a minimal message
      console.error(
        '[ChartErrorBoundary] Chart rendering failed:',
        errorInfo.error.message
      );
    }
  }

  /**
   * Reset the error boundary state to attempt re-rendering
   */
  private handleReset = (): void => {
    this.setState({
      hasError: false,
      errorInfo: null,
    });
  };

  /**
   * Render the fallback UI
   */
  private renderFallback(): ReactNode {
    const {
      fallback,
      fallbackTitle = 'Chart Error',
      fallbackMessage = 'Unable to display this chart. The data may be invalid or there was a rendering issue.',
      showRetry = true,
      showErrorDetails = true,
      fallbackHeight = 300,
      showCard = false,
    } = this.props;
    const { errorInfo } = this.state;

    // Use custom fallback if provided
    if (fallback) {
      if (typeof fallback === 'function' && errorInfo) {
        return fallback(errorInfo, this.handleReset);
      }
      return fallback as ReactNode;
    }

    const isDevelopment = import.meta.env.DEV;

    const content = (
      <Box
        sx={{
          height: fallbackHeight,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          p: 3,
          textAlign: 'center',
        }}
        role="alert"
        aria-live="polite"
      >
        <ErrorOutline
          sx={{
            fontSize: 48,
            color: 'error.main',
            mb: 2,
          }}
        />
        <Typography
          variant="h6"
          sx={{ mb: 1, fontWeight: 600, color: 'error.main' }}
        >
          {fallbackTitle}
        </Typography>
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ mb: 2, maxWidth: 400 }}
        >
          {fallbackMessage}
        </Typography>

        {showRetry && (
          <Button
            variant="outlined"
            size="small"
            startIcon={<Refresh />}
            onClick={this.handleReset}
            sx={{ mb: 2 }}
          >
            Try Again
          </Button>
        )}

        {showErrorDetails && isDevelopment && errorInfo && (
          <Alert
            severity="error"
            sx={{
              mt: 2,
              maxWidth: '100%',
              textAlign: 'left',
              '& .MuiAlert-message': {
                overflow: 'auto',
                maxHeight: 100,
              },
            }}
          >
            <AlertTitle>Debug Information</AlertTitle>
            <Typography
              variant="caption"
              component="pre"
              sx={{
                fontFamily: 'monospace',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                m: 0,
              }}
            >
              {errorInfo.error.message}
            </Typography>
          </Alert>
        )}
      </Box>
    );

    if (showCard) {
      return (
        <Card>
          <CardContent sx={{ p: 0, '&:last-child': { pb: 0 } }}>
            {content}
          </CardContent>
        </Card>
      );
    }

    return content;
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return this.renderFallback();
    }

    return this.props.children;
  }
}

/**
 * Helper function to wrap chart components with error boundary.
 *
 * Useful for inline usage without JSX element nesting.
 *
 * @param chart - The chart component to wrap
 * @param props - Optional error boundary props
 * @returns Chart wrapped in error boundary
 *
 * @example
 * ```tsx
 * {withChartErrorBoundary(
 *   <PieChart series={[{ data }]} width={300} height={300} />,
 *   { fallbackTitle: 'Pie Chart Error' }
 * )}
 * ```
 */
export function withChartErrorBoundary(
  chart: ReactNode,
  props?: Omit<ChartErrorBoundaryProps, 'children'>
): ReactNode {
  return <ChartErrorBoundary {...props}>{chart}</ChartErrorBoundary>;
}
