import { ReactNode } from 'react';
import {
  Box,
  Button,
  Typography,
  Stack,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { ArrowBack, OpenInNew } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { EntityAvatar, EntityType } from '../EntityAvatar';

/**
 * Props for DetailPageHeader component
 */
export interface DetailPageHeaderProps {
  /** Entity type for the avatar */
  entityType: EntityType;
  /** Entity ID for loading the avatar */
  entityId: number;
  /** Main title (entity name) */
  title: string;
  /** Subtitle text (e.g., "Security Auditor", "Blockchain Company") */
  subtitle?: string;
  /** Secondary subtitle (e.g., "Since January 15, 2024") */
  description?: string;
  /** Fallback text for avatar initials */
  avatarFallbackText?: string;
  /** External website URL */
  websiteUrl?: string;
  /** Website button label (default: "Visit Website") */
  websiteLabel?: string;
  /** Custom back navigation handler */
  onBack?: () => void;
  /** Additional action buttons to render after the website button */
  actions?: ReactNode;
  /** Content to render in the header area (e.g., bookmark button) */
  headerExtra?: ReactNode;
}

/**
 * DetailPageHeader - A reusable header component for detail pages.
 *
 * Provides consistent layout for:
 * - Back button
 * - Entity avatar
 * - Title and subtitles
 * - Website link
 * - Custom action buttons
 *
 * @example Basic usage:
 * ```tsx
 * <DetailPageHeader
 *   entityType="auditor"
 *   entityId={auditor.id}
 *   title={auditor.name}
 *   subtitle="Security Auditor"
 *   description={`Since ${formatDateLong(auditor.date)}`}
 *   websiteUrl={auditor.url}
 * />
 * ```
 *
 * @example With custom actions:
 * ```tsx
 * <DetailPageHeader
 *   entityType="protocol"
 *   entityId={protocol.id}
 *   title={protocol.name}
 *   subtitle={`by ${protocol.companyName}`}
 *   websiteUrl={protocol.url}
 *   actions={
 *     <>
 *       {canAddReport(auth) && (
 *         <Button
 *           variant="outlined"
 *           color="secondary"
 *           startIcon={<Assessment />}
 *           onClick={() => navigate(`/reports/add?protocol=${protocol.name}`)}
 *         >
 *           Add Report
 *         </Button>
 *       )}
 *     </>
 *   }
 * />
 * ```
 */
export function DetailPageHeader({
  entityType,
  entityId,
  title,
  subtitle,
  description,
  avatarFallbackText,
  websiteUrl,
  websiteLabel = 'Visit Website',
  onBack,
  actions,
  headerExtra,
}: DetailPageHeaderProps) {
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      navigate(-1);
    }
  };

  return (
    <Box sx={{ mb: 3 }}>
      {/* Back Button */}
      <Button
        variant="contained"
        startIcon={<ArrowBack />}
        onClick={handleBack}
        sx={{ mb: 2 }}
      >
        Back
      </Button>

      {/* Avatar and Title Section */}
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
        <EntityAvatar
          entityType={entityType}
          entityId={entityId}
          size="large"
          fallbackText={avatarFallbackText || title}
          sx={{ mr: 2 }}
        />
        <Box sx={{ flexGrow: 1 }}>
          <Typography
            variant={isMobile ? 'h5' : 'h4'}
            sx={{ fontWeight: 600, mb: 0.5, wordBreak: 'break-word' }}
          >
            {title}
          </Typography>
          {subtitle && (
            <Typography variant="body1" color="text.secondary">
              {subtitle}
            </Typography>
          )}
          {description && (
            <Typography variant="body2" color="text.secondary">
              {description}
            </Typography>
          )}
        </Box>
        {headerExtra}
      </Box>

      {/* Action Buttons */}
      {(websiteUrl || actions) && (
        <Stack direction="row" spacing={2} sx={{ mb: 2, flexWrap: 'wrap', gap: 1 }}>
          {websiteUrl && (
            <Button
              variant="contained"
              startIcon={<OpenInNew />}
              href={websiteUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              {websiteLabel}
            </Button>
          )}
          {actions}
        </Stack>
      )}
    </Box>
  );
}
