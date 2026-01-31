import React from 'react';
import { Box, Chip, Tooltip } from '@mui/material';
import { Verified as VerifiedIcon } from '@mui/icons-material';

interface VerifiedBadgeProps {
  verified?: boolean;
  method?: string | null;
}

export const VerifiedBadge: React.FC<VerifiedBadgeProps> = ({ verified, method }) => {
  if (!verified) return null;
  return (
    <Box sx={{ ml: 1 }}>
      <Tooltip title={method ? `Verified via ${method}` : 'Verified'}>
        <Chip
          icon={<VerifiedIcon />}
          label="Verified"
          color="success"
          size="small"
        />
      </Tooltip>
    </Box>
  );
};

export default VerifiedBadge;
