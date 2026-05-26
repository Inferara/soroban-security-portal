import { FC, useState } from 'react';
import { Box, Typography, Button } from '@mui/material';
import { Comment } from '../../api/soroban-security-portal/models/comment';
import { EntityAvatar } from '../../components/EntityAvatar';
import { MarkdownView } from '../../components/MarkdownView';
import { CommentEditor } from './CommentEditor';

interface CommentItemProps {
  comment: Comment;
  canReply: boolean;
  onReply: (parentCommentId: number, content: string) => Promise<boolean>;
  isReply?: boolean;
}

export const CommentItem: FC<CommentItemProps> = ({ comment, canReply, onReply, isReply = false }) => {
  const [replying, setReplying] = useState(false);

  return (
    <Box sx={{ display: 'flex', gap: 1.5, py: 1.5, ...(isReply ? { ml: 5, borderLeft: 2, borderColor: 'divider', pl: 2 } : {}) }}>
      <EntityAvatar entityType="user" entityId={comment.authorId} size="small" fallbackText={comment.authorName} />
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box sx={{ display: 'flex', flexDirection: 'row', alignItems: 'baseline' }}>
          <Typography variant="subtitle2" component="span" sx={{ fontWeight: 600 }}>
            {comment.authorName || 'Anonymous'}
          </Typography>
          <Typography variant="caption" sx={{ ml: 1, color: 'text.secondary' }}>
            {new Date(comment.createdAt).toLocaleString()}{comment.isEdited ? ' · edited' : ''}
          </Typography>
        </Box>
        <MarkdownView content={comment.content} sx={{ p: 0, mt: 0.5 }} />
        {canReply && !isReply && (
          <Button size="small" onClick={() => setReplying((r) => !r)} sx={{ mt: 0.5 }}>
            {replying ? 'Cancel' : 'Reply'}
          </Button>
        )}
        {replying && (
          <Box sx={{ mt: 1 }}>
            <CommentEditor
              submitLabel="Reply"
              onCancel={() => setReplying(false)}
              onSubmit={async (content) => {
                const ok = await onReply(comment.id, content);
                if (ok) setReplying(false);
                return ok;
              }}
            />
          </Box>
        )}
        {comment.replies?.length > 0 && (
          <Box sx={{ mt: 1 }}>
            {comment.replies.map((r) => (
              <CommentItem key={r.id} comment={r} canReply={canReply} onReply={onReply} isReply />
            ))}
          </Box>
        )}
      </Box>
    </Box>
  );
};
