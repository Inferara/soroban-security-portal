import React, { useEffect, useState } from 'react';
import { Box, Typography, List, ListItem, Chip, Paper } from '@mui/material';

interface WatchedEntity {
  entityId: number;
  entityType: string;
}

interface WatchedSectionProps {
  userId: number;
}

export const WatchedSection: React.FC<WatchedSectionProps> = ({ userId }) => {
  const [watched, setWatched] = useState<WatchedEntity[]>([]);

  useEffect(() => {
    fetch(`/api/watch/user?userId=${userId}`)
      .then(res => res.json())
      .then(setWatched);
  }, [userId]);

  return (
    <Paper elevation={2} sx={{ p: 2, mb: 2 }}>
      <Typography variant="h6" gutterBottom>Watched</Typography>
      <List>
        {watched.length === 0 && (
          <ListItem>
            <Typography color="text.secondary">No watched items.</Typography>
          </ListItem>
        )}
        {watched.map((w, i) => (
          <ListItem key={i} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Chip label={w.entityType} size="small" color={w.entityType === 'Protocol' ? 'primary' : 'secondary'} />
            <Typography variant="body2">ID: {w.entityId}</Typography>
          </ListItem>
        ))}
      </List>
    </Paper>
  );
};
