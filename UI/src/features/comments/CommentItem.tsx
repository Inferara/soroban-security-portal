import { FC, useState } from 'react';
import { Box, Typography, Button } from '@mui/material';
import { Comment, VoteType } from '../../api/soroban-security-portal/models/comment';
import { EntityAvatar } from '../../components/EntityAvatar';
import { MarkdownView } from '../../components/MarkdownView';
import { CommentEditor } from './CommentEditor';
import { CommentVoteButtons } from './CommentVoteButtons';
import { highlightMentions } from './mentions';

interface CommentItemProps {
  comment: Comment;
  canReply: boolean;
  onReply: (parentCommentId: number, content: string) => Promise<boolean>;
  onVote: (id: number, voteType: VoteType) => void;
  canVote: boolean;
  onEdit: (id: number, content: string) => Promise<boolean>;
  onDelete: (id: number) => void;
  isAdmin: boolean;
  isReply?: boolean;
}

export const CommentItem: FC<CommentItemProps> = ({
  comment,
  canReply,
  onReply,
  onVote,
  canVote,
  onEdit,
  onDelete,
  isAdmin,
  isReply = false,
}) => {
  const [replying, setReplying] = useState(false);
  const [editing, setEditing] = useState(false);

  const canDelete = comment.isOwn || isAdmin;
  const canEdit =
    comment.isOwn &&
    Date.now() - new Date(comment.createdAt).getTime() < 30 * 60 * 1000;

  return (
    <Box sx={{ display: 'flex', gap: 1.5, py: 1.5, ...(isReply ? { ml: 5, borderLeft: 2, borderColor: 'divider', pl: 2 } : {}) }}>
      <EntityAvatar entityType="user" entityId={comment.authorId} size="small" fallbackText={comment.authorName} />
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box sx={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 1 }}>
          <Box sx={{ display: 'flex', flexDirection: 'row', alignItems: 'baseline', flex: 1 }}>
            <Typography variant="subtitle2" component="span" sx={{ fontWeight: 600 }}>
              {comment.authorName || 'Anonymous'}
            </Typography>
            <Typography variant="caption" sx={{ ml: 1, color: 'text.secondary' }}>
              {new Date(comment.createdAt).toLocaleString()}{comment.isEdited ? ' · edited' : ''}
            </Typography>
          </Box>
          <CommentVoteButtons
            upvoteCount={comment.upvoteCount}
            downvoteCount={comment.downvoteCount}
            currentUserVote={comment.currentUserVote}
            canVote={canVote && !comment.isOwn}
            onVote={(vt) => onVote(comment.id, vt)}
          />
        </Box>

        {editing ? (
          <Box sx={{ mt: 1 }}>
            <CommentEditor
              initialValue={comment.content}
              submitLabel="Save"
              onCancel={() => setEditing(false)}
              onSubmit={async (content) => {
                const ok = await onEdit(comment.id, content);
                if (ok) setEditing(false);
                return ok;
              }}
            />
          </Box>
        ) : (
          <>
            <MarkdownView content={highlightMentions(comment.content)} sx={{ p: 0, mt: 0.5 }} />
            <Box sx={{ display: 'flex', gap: 0.5, mt: 0.5, flexWrap: 'wrap' }}>
              {canReply && !isReply && (
                <Button size="small" onClick={() => setReplying((r) => !r)}>
                  {replying ? 'Cancel' : 'Reply'}
                </Button>
              )}
              {canEdit && (
                <Button size="small" onClick={() => setEditing(true)}>
                  Edit
                </Button>
              )}
              {canDelete && (
                <Button
                  size="small"
                  color="error"
                  onClick={() => {
                    if (window.confirm('Delete this comment?')) onDelete(comment.id);
                  }}
                >
                  Delete
                </Button>
              )}
            </Box>
          </>
        )}

        {!editing && replying && (
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
              <CommentItem
                key={r.id}
                comment={r}
                canReply={canReply}
                onReply={onReply}
                onVote={onVote}
                canVote={canVote}
                onEdit={onEdit}
                onDelete={onDelete}
                isAdmin={isAdmin}
                isReply
              />
            ))}
          </Box>
        )}
      </Box>
    </Box>
  );
};
