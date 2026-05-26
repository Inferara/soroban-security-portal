import { FC } from 'react';
import { Box, IconButton, Tooltip, Typography } from '@mui/material';
import { ArrowUpward, ArrowDownward } from '@mui/icons-material';

interface CommentVoteButtonsProps {
  upvoteCount: number;
  downvoteCount: number;
  currentUserVote: string | null;
  canVote: boolean; // authenticated AND not the author's own comment
  onVote: (voteType: 'upvote' | 'downvote' | 'none') => void;
}

export const CommentVoteButtons: FC<CommentVoteButtonsProps> = ({ upvoteCount, downvoteCount, currentUserVote, canVote, onVote }) => {
  const net = upvoteCount - downvoteCount;
  const up = currentUserVote === 'upvote';
  const down = currentUserVote === 'downvote';
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
      <Tooltip title={canVote ? 'Upvote' : ''}>
        <span>
          <IconButton size="small" disabled={!canVote} color={up ? 'primary' : 'default'} aria-label="upvote"
            aria-pressed={up} onClick={() => onVote(up ? 'none' : 'upvote')}>
            <ArrowUpward fontSize="inherit" />
          </IconButton>
        </span>
      </Tooltip>
      <Typography variant="body2" sx={{ minWidth: 16, textAlign: 'center', fontWeight: 600 }} aria-label="score">{net}</Typography>
      <Tooltip title={canVote ? 'Downvote' : ''}>
        <span>
          <IconButton size="small" disabled={!canVote} color={down ? 'error' : 'default'} aria-label="downvote"
            aria-pressed={down} onClick={() => onVote(down ? 'none' : 'downvote')}>
            <ArrowDownward fontSize="inherit" />
          </IconButton>
        </span>
      </Tooltip>
    </Box>
  );
};
