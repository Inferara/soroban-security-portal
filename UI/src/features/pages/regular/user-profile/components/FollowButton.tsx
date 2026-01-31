import React from 'react';
import { Button, CircularProgress } from '@mui/material';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import PersonRemoveIcon from '@mui/icons-material/PersonRemove';

interface FollowButtonProps {
  isFollowing: boolean;
  loading: boolean;
  onClick: () => void;
}

export const FollowButton: React.FC<FollowButtonProps> = ({ isFollowing, loading, onClick }) => {
  return (
    <Button
      variant={isFollowing ? 'outlined' : 'contained'}
      startIcon={loading ? <CircularProgress size={16} /> : (isFollowing ? <PersonRemoveIcon /> : <PersonAddIcon />)}
      onClick={onClick}
      disabled={loading}
      sx={{
        textTransform: 'none',
        fontWeight: 600,
        minWidth: 120,
      }}
    >
      {loading ? 'Loading...' : isFollowing ? 'Unfollow' : 'Follow'}
    </Button>
  );
};
