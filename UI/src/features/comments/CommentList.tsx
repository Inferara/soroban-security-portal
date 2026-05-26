import { FC } from 'react';
import { Box, Button, CircularProgress, Typography } from '@mui/material';
import { CommentEntityType } from '../../api/soroban-security-portal/models/comment';
import { useAppAuth } from '../authentication/useAppAuth';
import { useComments } from './useComments';
import { CommentItem } from './CommentItem';
import { CommentEditor } from './CommentEditor';

interface CommentListProps {
  entityType: CommentEntityType;
  entityId: number;
}

export const CommentList: FC<CommentListProps> = ({ entityType, entityId }) => {
  const { isAuthenticated, login } = useAppAuth();
  const { comments, loading, error, hasMore, loadMore, post, vote } = useComments(entityType, entityId);
  const canVote = isAuthenticated;

  return (
    <Box>
      {isAuthenticated ? (
        <CommentEditor onSubmit={(content) => post(content, null)} submitLabel="Comment" />
      ) : (
        <Box sx={{ mb: 2 }}>
          <Button variant="outlined" onClick={login}>Log in to comment</Button>
        </Box>
      )}

      {error && <Typography color="error" sx={{ my: 2 }}>{error}</Typography>}
      {loading && comments.length === 0 && (
        <Box sx={{ textAlign: 'center', my: 3 }}>
          <CircularProgress size={24} />
        </Box>
      )}
      {!loading && comments.length === 0 && !error && (
        <Typography sx={{ color: 'text.secondary', my: 3 }}>
          No comments yet. Be the first to start the discussion.
        </Typography>
      )}

      {comments.map((c) => (
        <CommentItem
          key={c.id}
          comment={c}
          canReply={isAuthenticated}
          onReply={(parentId, content) => post(content, parentId)}
          onVote={(id, vt) => vote(id, vt)}
          canVote={canVote}
        />
      ))}

      {hasMore && (
        <Box sx={{ textAlign: 'center', mt: 2 }}>
          <Button onClick={loadMore} disabled={loading}>Load more</Button>
        </Box>
      )}
    </Box>
  );
};
