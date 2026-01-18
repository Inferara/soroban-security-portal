import { ReactNode } from 'react';
import {
  Box,
  Button,
  CircularProgress,
  Alert,
} from '@mui/material';
import { ArrowBack } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';

/**
 * Props for DetailPageLayout component
 */
export interface DetailPageLayoutProps {
  /** Whether data is currently loading */
  loading: boolean;
  /** Error message to display, if any */
  error: string | null;
  /** The loaded entity (null/undefined triggers error state) */
  entity: unknown | null | undefined;
  /** Entity name for the error message (e.g., "Auditor", "Company") */
  entityName: string;
  /** Page content to render when loaded successfully */
  children: ReactNode;
  /** Custom back navigation handler (defaults to navigate(-1)) */
  onBack?: () => void;
  /** Fallback path if navigate(-1) is not suitable */
  fallbackPath?: string;
  /** Maximum width for the content area (default: 1400px) */
  maxWidth?: string | number;
}

/**
 * DetailPageLayout - A wrapper component for detail pages that handles
 * loading and error states consistently.
 *
 * This component eliminates the duplicated loading/error handling code
 * found in all detail pages (auditor-details, company-details, etc.).
 *
 * @example Basic usage:
 * ```tsx
 * <DetailPageLayout
 *   loading={loading}
 *   error={error}
 *   entity={auditor}
 *   entityName="Auditor"
 * >
 *   <DetailPageHeader {...} />
 *   <StatisticsCards {...} />
 *   <DetailTabs {...} />
 * </DetailPageLayout>
 * ```
 *
 * @example With custom back handler:
 * ```tsx
 * <DetailPageLayout
 *   loading={loading}
 *   error={error}
 *   entity={report}
 *   entityName="Report"
 *   onBack={() => navigate('/reports')}
 * >
 *   {content}
 * </DetailPageLayout>
 * ```
 */
export function DetailPageLayout({
  loading,
  error,
  entity,
  entityName,
  children,
  onBack,
  fallbackPath,
  maxWidth = '1400px',
}: DetailPageLayoutProps) {
  const navigate = useNavigate();

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else if (fallbackPath) {
      navigate(fallbackPath);
    } else {
      navigate(-1);
    }
  };

  // Loading state
  if (loading) {
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '50vh',
        }}
        role="status"
        aria-label={`Loading ${entityName.toLowerCase()} details`}
      >
        <CircularProgress size={60} />
      </Box>
    );
  }

  // Error state
  if (error || !entity) {
    return (
      <Box sx={{ p: 3 }}>
        <Button
          variant="contained"
          startIcon={<ArrowBack />}
          onClick={handleBack}
          sx={{ mb: 2 }}
        >
          Back
        </Button>
        <Alert severity="error">
          {error || `${entityName} not found`}
        </Alert>
      </Box>
    );
  }

  // Success state - render children
  return (
    <Box sx={{ p: { xs: 2, md: 3 }, maxWidth, mx: 'auto' }}>
      {children}
    </Box>
  );
}
