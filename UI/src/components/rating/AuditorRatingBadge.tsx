import { FC, useEffect, useState } from 'react';
import { Box, Rating, Typography, Tooltip } from '@mui/material';
import { getRatingSummaryCall } from '../../api/soroban-security-portal/soroban-security-portal-api';
import { EntityType, RatingSummary } from '../../api/soroban-security-portal/models/rating';

export interface AuditorRatingBadgeProps {
  auditorId: number;
}

export const AuditorRatingBadge: FC<AuditorRatingBadgeProps> = ({ auditorId }) => {
  const [summary, setSummary] = useState<RatingSummary | null>(null);

  useEffect(() => {
    getRatingSummaryCall(EntityType.Auditor, auditorId)
      .then(setSummary)
      .catch(() => {});
  }, [auditorId]);

  if (!summary || summary.totalReviews === 0) return null;

  return (
    <Tooltip title={`${summary.averageScore.toFixed(1)} / 5 (${summary.totalReviews} ${summary.totalReviews === 1 ? 'review' : 'reviews'})`}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
        <Rating value={summary.averageScore} precision={0.1} readOnly size="small" />
        <Typography variant="caption" color="text.secondary">
          ({summary.totalReviews})
        </Typography>
      </Box>
    </Tooltip>
  );
};
