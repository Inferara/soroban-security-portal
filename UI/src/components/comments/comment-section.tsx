import { FC, useState, useEffect, useCallback } from 'react';
import { Box, Typography, TextField, Button, CircularProgress, Stack } from '@mui/material';
import { Send } from '@mui/icons-material';
import { CommentItemComponent } from './comment-item';
import { getCommentsCall, addCommentCall } from '../../api/soroban-security-portal/soroban-security-portal-api';
import { CommentItem, CreateCommentRequest, ReferenceType } from '../../api/soroban-security-portal/models/comment';
import { useAppAuth } from '../../features/authentication/useAppAuth';
import { showMessage } from '../../features/dialog-handler/dialog-handler';

interface CommentSectionProps {
    referenceId: number;
    referenceType: ReferenceType;
}

export const CommentSection: FC<CommentSectionProps> = ({ referenceId, referenceType }) => {
    const { auth } = useAppAuth();
    const [comments, setComments] = useState<CommentItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [newComment, setNewComment] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const fetchComments = useCallback(async () => {
        setLoading(true);
        try {
            const data = await getCommentsCall(referenceId, referenceType);
            setComments(data);
        } catch (error) {
            console.error("Failed to load comments", error);
        } finally {
            setLoading(false);
        }
    }, [referenceId, referenceType]);

    useEffect(() => {
        if (referenceId) {
            fetchComments();
        }
    }, [fetchComments, referenceId]);

    const handlePostComment = async () => {
        if (!newComment.trim()) return;

        if (!auth.isAuthenticated) {
            showMessage("Please log in to post a comment");
            return;
        }

        setSubmitting(true);
        try {
            const request: CreateCommentRequest = {
                referenceId,
                referenceType,
                content: newComment
            };
            const addedComment = await addCommentCall(request);
            setComments([addedComment, ...comments]);
            setNewComment('');
            showMessage("Comment posted");
        } catch (error) {
            console.error(error);
            showMessage("Failed to post comment");
        } finally {
            setSubmitting(false);
        }
    };

    const handleCommentUpdated = (updatedComment: CommentItem) => {
        setComments(comments.map(c => c.id === updatedComment.id ? updatedComment : c));
    };

    const handleCommentDeleted = (commentId: number) => {
        setComments(comments.filter(c => c.id !== commentId));
    };

    return (
        <Box sx={{ mt: 4 }}>
            <Typography variant="h6" gutterBottom>
                Comments ({comments.length})
            </Typography>

            {/* Add Comment Input */}
            {auth.isAuthenticated ? (
                <Box sx={{ mb: 4 }}>
                    <TextField
                        fullWidth
                        multiline
                        rows={3}
                        placeholder="Write a comment..."
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        variant="outlined"
                        disabled={submitting}
                    />
                    <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1 }}>
                        <Button
                            variant="contained"
                            endIcon={submitting ? <CircularProgress size={20} /> : <Send />}
                            onClick={handlePostComment}
                            disabled={!newComment.trim() || submitting}
                        >
                            Post Comment
                        </Button>
                    </Box>
                </Box>
            ) : (
                <Box sx={{ mb: 4, p: 2, bgcolor: 'action.hover', borderRadius: 1, textAlign: 'center' }}>
                    <Typography color="text.secondary">
                        Please <Button color="primary" onClick={() => showMessage("Please log in via the top right menu")}>log in</Button> to post comments.
                    </Typography>
                </Box>
            )}

            {/* List */}
            {loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                    <CircularProgress />
                </Box>
            ) : (
                <Stack spacing={0}>
                    {comments.map(comment => (
                        <CommentItemComponent
                            key={comment.id}
                            comment={comment}
                            onCommentUpdated={handleCommentUpdated}
                            onCommentDeleted={handleCommentDeleted}
                        />
                    ))}
                    {comments.length === 0 && (
                        <Typography color="text.secondary" align="center">
                            No comments yet. Be the first to share your thoughts!
                        </Typography>
                    )}
                </Stack>
            )}
        </Box>
    );
};
