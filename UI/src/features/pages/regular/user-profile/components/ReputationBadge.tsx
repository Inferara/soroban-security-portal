import React from 'react';
import { Box, Typography, Tooltip } from '@mui/material';
import StarIcon from '@mui/icons-material/Star';

interface ReputationBadgeProps {
  score: number;
}

export const ReputationBadge: React.FC<ReputationBadgeProps> = ({ score }) => {
  const getReputationLevel = (score: number) => {
    if (score >= 10000) return { label: 'Elite', color: '#FFD700' };
    if (score >= 5000) return { label: 'Expert', color: '#4CAF50' };
    if (score >= 1000) return { label: 'Advanced', color: '#2196F3' };
    return { label: 'Member', color: '#9E9E9E' };
  };

  const level = getReputationLevel(score);

  return (
    <Tooltip title={`Reputation Score: ${score.toLocaleString()}`} arrow>
      <Box
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 0.5,
          px: 1.5,
          py: 0.5,
          borderRadius: 2,
          backgroundColor: `${level.color}20`,
          border: `1px solid ${level.color}`,
        }}
      >
        <StarIcon sx={{ fontSize: '1rem', color: level.color }} />
        <Typography
          variant="body2"
          sx={{
            fontWeight: 600,
            color: level.color,
            fontSize: '0.875rem'
          }}
        >
          {score.toLocaleString()}
        </Typography>
        <Typography
          variant="caption"
          sx={{
            color: level.color,
            fontSize: '0.75rem',
            ml: 0.5
          }}
        >
          {level.label}
        </Typography>
      </Box>
    </Tooltip>
  );
};
