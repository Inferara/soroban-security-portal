import React, { useEffect, useState } from 'react';
import { Button } from '@mui/material';

interface WatchButtonProps {
  userId: number;
  entityId: number;
  entityType: 'Protocol' | 'Auditor';
}

export const WatchButton: React.FC<WatchButtonProps> = ({ userId, entityId, entityType }) => {
  const [watched, setWatched] = useState(false);
  const [count, setCount] = useState(0);

  useEffect(() => {
    fetch(`/api/watch/count?entityId=${entityId}&entityType=${entityType}`)
      .then(res => res.json())
      .then(setCount);
    fetch(`/api/watch/user?userId=${userId}`)
      .then(res => res.json())
      .then((data) => {
        setWatched(data.some((w: any) => w.entityId === entityId && w.entityType === entityType));
      });
  }, [userId, entityId, entityType]);

  const handleClick = async () => {
    if (watched) {
      await fetch('/api/watch', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, entityId, entityType })
      });
      setWatched(false);
      setCount(c => c - 1);
    } else {
      await fetch('/api/watch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, entityId, entityType })
      });
      setWatched(true);
      setCount(c => c + 1);
    }
  };

  return (
    <Button
      variant={watched ? 'contained' : 'outlined'}
      color={watched ? 'primary' : 'inherit'}
      onClick={handleClick}
      sx={{ minWidth: 120 }}
    >
      {watched ? 'Unwatch' : 'Watch'} ({count})
    </Button>
  );
};
