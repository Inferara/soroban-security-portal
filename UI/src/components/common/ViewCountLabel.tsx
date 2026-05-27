import { FC } from 'react';
import { Box, Tooltip, Typography } from '@mui/material';
import VisibilityIcon from '@mui/icons-material/Visibility';
import { PageViewCount } from '../../api/soroban-security-portal/models/analytics';

export interface ViewCountLabelProps {
  /** The view counts, or null while still loading. */
  count: PageViewCount | null;
}

/**
 * A quiet inline "👁 N views" indicator for detail-page bylines. It reads as a meta/engagement
 * stat (next to the date), not as a core domain metric. The unique-visitor count is in the tooltip.
 * Renders nothing until the count has loaded, so it gently appears rather than flashing a zero.
 */
export const ViewCountLabel: FC<ViewCountLabelProps> = ({ count }) => {
  if (!count) return null;

  const viewsText = `${count.total} ${count.total === 1 ? 'view' : 'views'}`;
  const uniqueText = `${count.unique} unique visitor${count.unique === 1 ? '' : 's'}`;

  return (
    <Tooltip title={uniqueText}>
      <Box
        component="span"
        sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, color: 'text.secondary' }}
      >
        <VisibilityIcon sx={{ fontSize: 16 }} aria-hidden />
        <Typography variant="body2" color="text.secondary" component="span">
          {viewsText}
        </Typography>
      </Box>
    </Tooltip>
  );
};
