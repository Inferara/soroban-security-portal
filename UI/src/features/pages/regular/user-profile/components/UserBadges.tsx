import React from 'react';
import { Stack, Tooltip, Box, Typography } from '@mui/material';
import { Badge as BadgeType } from '../../../../../api/soroban-security-portal/models/user';

interface UserBadgesProps {
  badges: BadgeType[];
}

export const UserBadges: React.FC<UserBadgesProps> = ({ badges }) => {
  if (!badges || badges.length === 0) return null;

  return (
    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
      {badges.map((badge) => (
        <Tooltip key={badge.id} title={badge.description || badge.name} arrow>
          <Box
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 0.5,
              px: 1.5,
              py: 0.5,
              borderRadius: 2,
              backgroundColor: badge.color ? `${badge.color}20` : 'action.hover',
              border: `1px solid ${badge.color || 'divider'}`,
              cursor: 'pointer',
              transition: 'all 0.2s',
              '&:hover': {
                transform: 'translateY(-2px)',
                boxShadow: 2,
              }
            }}
          >
            <Typography component="span" sx={{ fontSize: '1rem' }}>
              {badge.icon}
            </Typography>
            <Typography
              variant="caption"
              sx={{
                fontWeight: 600,
                color: badge.color || 'text.primary',
                fontSize: '0.75rem'
              }}
            >
              {badge.name}
            </Typography>
          </Box>
        </Tooltip>
      ))}
    </Stack>
  );
};
