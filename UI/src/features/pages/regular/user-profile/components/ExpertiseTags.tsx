import React from 'react';
import { Chip, Stack } from '@mui/material';

interface ExpertiseTagsProps {
  tags: string[];
}

export const ExpertiseTags: React.FC<ExpertiseTagsProps> = ({ tags }) => {
  if (!tags || tags.length === 0) return null;

  return (
    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
      {tags.map((tag, index) => (
        <Chip
          key={index}
          label={tag}
          size="small"
          sx={{
            backgroundColor: 'primary.main',
            color: 'primary.contrastText',
            fontWeight: 500,
            fontSize: '0.8125rem',
            '&:hover': {
              backgroundColor: 'primary.dark',
            }
          }}
        />
      ))}
    </Stack>
  );
};
