import { FC, useState, useEffect, useCallback } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Stack,
  IconButton,
  Menu,
  MenuItem,
  Chip,
  CircularProgress,
  Alert,
  Divider,
} from '@mui/material';
import {
  Send,
  MoreVert,
  Edit,
  Delete,
  Comment as CommentIcon,
} from '@mui/icons-material';
import { useAppAuth } from '../features/authentication/useAppAuth';
import { isAuthorized } from '../features/authentication/authPermissions';
import {
  getCommentsCall,
  addCommentCall,
  updateCommentCall,
  deleteCommentCall,
} from '../api/soroban-security-portal/soroban-security-portal-api';
import {
  Comment,
  CommentEntityType,
  CreateComment,
  UpdateComment,
} from '../api/soroban-security-portal/models/comment';
import { formatDateLong } from '../utils';
import { EntityAvatar } from './EntityAvatar';
import { MarkdownEditor } from './MarkdownEditor';
import { MarkdownView } from './MarkdownView';

export interface CommentListProps {
  entityType: CommentEntityType;
  entityId: number;
  showFilter?: boolean;
  includeVulnerabilityComments?: boolean;
  vulnerabilityIds?: number[];
}

type CommentFilter = 'all' | 'entity-only';

export const CommentList: FC<CommentListProps> = ({
  entityType,
  entityId,
  showFilter = false,
  includeVulnerabilityComments = false,
  vulnerabilityIds = [],
}: CommentListProps) => {
  const { auth } = useAppAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newComment, setNewComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editContent, setEditContent] = useState('');
  const [filter, setFilter] = useState<CommentFilter>('all');
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [menuCommentId, setMenuCommentId] = useState<number | null>(null);

  const isAuthenticated = isAuthorized(auth);

  const fetchComments = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      if (includeVulnerabilityComments && filter === 'all') {
        // Fetch comments for the entity and all related vulnerabilities
        const promises = [
          getCommentsCall(entityType, entityId),
          ...vulnerabilityIds.map((vulnId) =>
            getCommentsCall(CommentEntityType.Vulnerability, vulnId)
          ),
        ];
        const results = await Promise.all(promises);
        const allComments = results.flat();
        // Sort by creation date (newest first)
        allComments.sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        setComments(allComments);
      } else {
        // Fetch only entity-level comments
        const entityComments = await getCommentsCall(entityType, entityId);
        setComments(entityComments);
      }
    } catch (err) {
      console.error('Error fetching comments:', err);
      setError('Failed to load comments');
    } finally {
      setLoading(false);
    }
  }, [entityId, entityType, filter, includeVulnerabilityComments, vulnerabilityIds]);

  useEffect(() => {
    if (entityId) {
      void fetchComments();
    }
  }, [entityId, fetchComments]);

  const handleSubmit = async () => {
    if (!newComment.trim() || !isAuthenticated) {
      return;
    }

    try {
      setSubmitting(true);
      const createComment: CreateComment = {
        entityType,
        entityId,
        content: newComment.trim(),
      };
      const addedComment = await addCommentCall(createComment);
      setComments((prev: Comment[]) => [addedComment, ...prev]);
      setNewComment('');
    } catch (err) {
      console.error('Error adding comment:', err);
      setError('Failed to add comment');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (comment: Comment) => {
    setEditingId(comment.id);
    setEditContent(comment.content);
    setAnchorEl(null);
  };

  const handleSaveEdit = async () => {
    if (!editingId || !editContent.trim()) {
      return;
    }

    try {
      const updateComment: UpdateComment = {
        id: editingId,
        content: editContent.trim(),
      };
      const updatedComment = await updateCommentCall(updateComment);
      setComments((prev: Comment[]) =>
        prev.map((c: Comment) => (c.id === editingId ? updatedComment : c))
      );
      setEditingId(null);
      setEditContent('');
    } catch (err) {
      console.error('Error updating comment:', err);
      setError('Failed to update comment');
    }
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditContent('');
  };

  const handleDelete = async (commentId: number) => {
    if (!window.confirm('Are you sure you want to delete this comment?')) {
      return;
    }

    try {
      await deleteCommentCall(commentId);
      setComments((prev: Comment[]) => prev.filter((c: Comment) => c.id !== commentId));
      setAnchorEl(null);
    } catch (err) {
      console.error('Error deleting comment:', err);
      setError('Failed to delete comment');
    }
  };

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, commentId: number): void => {
    setAnchorEl(event.currentTarget);
    setMenuCommentId(commentId);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setMenuCommentId(null);
  };

  const canEditComment = (comment: Comment): boolean => {
    if (!isAuthenticated || !auth.user?.profile) {
      return false;
    }
    // Compare user ID - backend should return userId that matches the current user's identifier
    // Using sub (subject) from OIDC profile as the user identifier
    const currentUserId = auth.user.profile.sub;
    return currentUserId ? Number(currentUserId) === comment.userId || currentUserId === comment.userId.toString() : false;
  };

  const filteredComments = filter === 'entity-only'
    ? comments.filter((c: Comment) => c.entityType === entityType && c.entityId === entityId)
    : comments;

  return (
    <Box>
      {/* Filter Tabs */}
      {showFilter && includeVulnerabilityComments && (
        <Box sx={{ mb: 2 }}>
          <Stack direction="row" spacing={1}>
            <Chip
              label="All Comments"
              onClick={() => setFilter('all')}
              color={filter === 'all' ? 'primary' : 'default'}
              variant={filter === 'all' ? 'filled' : 'outlined'}
              sx={{ cursor: 'pointer' }}
            />
            <Chip
              label="Report-level Only"
              onClick={() => setFilter('entity-only')}
              color={filter === 'entity-only' ? 'primary' : 'default'}
              variant={filter === 'entity-only' ? 'filled' : 'outlined'}
              sx={{ cursor: 'pointer' }}
            />
          </Stack>
        </Box>
      )}

      {/* Error Message */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Add Comment Form */}
      {isAuthenticated && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
              <CommentIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
              Add a Comment
            </Typography>
            <MarkdownEditor
              value={newComment}
              onChange={setNewComment}
              label=""
              height="150px"
            />
            <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}>
              <Button
                variant="contained"
                startIcon={<Send />}
                onClick={handleSubmit}
                disabled={!newComment.trim() || submitting}
              >
                {submitting ? <CircularProgress size={20} /> : 'Post Comment'}
              </Button>
            </Box>
          </CardContent>
        </Card>
      )}

      {/* Comments List */}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
        </Box>
      ) : filteredComments.length === 0 ? (
        <Card>
          <CardContent>
            <Typography color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
              {isAuthenticated
                ? 'No comments yet. Be the first to comment!'
                : 'No comments yet. Log in to add a comment.'}
            </Typography>
          </CardContent>
        </Card>
      ) : (
        <Stack spacing={2}>
          {filteredComments.map((comment: Comment, index: number) => (
            <Card key={comment.id}>
              <CardContent>
                <Box sx={{ display: 'flex', gap: 2 }}>
                  {/* Avatar */}
                  <Box>
                    <EntityAvatar
                      entityType="user"
                      entityId={comment.userId}
                      size="medium"
                      fallbackText={comment.userName}
                    />
                  </Box>

                  {/* Comment Content */}
                  <Box sx={{ flexGrow: 1 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                      <Box>
                        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                          {comment.userName}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {formatDateLong(comment.createdAt)}
                          {comment.updatedAt && comment.updatedAt !== comment.createdAt && (
                            <span> (edited)</span>
                          )}
                        </Typography>
                      </Box>
                      {canEditComment(comment) && (
                        <IconButton
                          size="small"
                          onClick={(e: React.MouseEvent<HTMLElement>) => handleMenuOpen(e, comment.id)}
                        >
                          <MoreVert />
                        </IconButton>
                      )}
                    </Box>

                    {editingId === comment.id ? (
                      <Box>
                        <MarkdownEditor
                          value={editContent}
                          onChange={setEditContent}
                          label=""
                          height="150px"
                        />
                        <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
                          <Button
                            variant="contained"
                            size="small"
                            onClick={handleSaveEdit}
                          >
                            Save
                          </Button>
                          <Button
                            variant="outlined"
                            size="small"
                            onClick={handleCancelEdit}
                          >
                            Cancel
                          </Button>
                        </Stack>
                      </Box>
                    ) : (
                      <Box sx={{ mt: 1 }}>
                        <MarkdownView content={comment.content} />
                      </Box>
                    )}
                  </Box>
                </Box>
              </CardContent>
              {index < filteredComments.length - 1 && <Divider />}
            </Card>
          ))}
        </Stack>
      )}

      {/* Context Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem
          onClick={() => {
            const comment = comments.find((c: Comment) => c.id === menuCommentId);
            if (comment) {
              handleEdit(comment);
            }
          }}
        >
          <Edit sx={{ mr: 1 }} fontSize="small" />
          Edit
        </MenuItem>
        <MenuItem
          onClick={() => {
            if (menuCommentId) {
              handleDelete(menuCommentId);
            }
          }}
          sx={{ color: 'error.main' }}
        >
          <Delete sx={{ mr: 1 }} fontSize="small" />
          Delete
        </MenuItem>
      </Menu>
    </Box>
  );
};
