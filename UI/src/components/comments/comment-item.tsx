import { FC, useState, useEffect } from 'react';
import {
    Box,
    Typography,
    Avatar,
    IconButton,
    TextField,
    Button,
    Card,
    CardContent,
    Stack,
    Dialog,
    DialogTitle,
    DialogContent,
    List,
    ListItem,
    ListItemText,
    Divider,
    Tooltip
} from '@mui/material';
import { Edit, Delete, History, Save, Cancel } from '@mui/icons-material';
import { CommentItem, UpdateCommentRequest, CommentHistoryItem } from '../../api/soroban-security-portal/models/comment';
import { updateCommentCall, deleteCommentCall, getCommentHistoryCall } from '../../api/soroban-security-portal/soroban-security-portal-api';
import { useAppAuth } from '../../features/authentication/useAppAuth';
import { isAdminOrModerator } from '../../features/authentication/authPermissions';
import { showMessage } from '../../features/dialog-handler/dialog-handler';

export interface CommentItemProps {
    comment: CommentItem;
    onCommentUpdated: (comment: CommentItem) => void;
    onCommentDeleted: (commentId: number) => void;
}

export const CommentItemComponent: FC<CommentItemProps> = ({ comment, onCommentUpdated, onCommentDeleted }) => {
    const { auth } = useAppAuth();
    const [isEditing, setIsEditing] = useState(false);
    const [editContent, setEditContent] = useState(comment.content);
    const [timeLeft, setTimeLeft] = useState<string>("");
    const [isExpired, setIsExpired] = useState(false);
    const [historyOpen, setHistoryOpen] = useState(false);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [historyData, setHistoryData] = useState<CommentHistoryItem[]>([]);

    const canModify = comment.isEditable;
    const isModOrAdmin = isAdminOrModerator(auth);

    // Timer logic for 30 min window
    useEffect(() => {
        if (!comment.isEditable) {
            setIsExpired(true);
            return;
        }

        const created = new Date(comment.created);
        const deadline = new Date(created.getTime() + 30 * 60000);

        const timer = setInterval(() => {
            const now = new Date();
            const diff = deadline.getTime() - now.getTime();

            if (diff <= 0) {
                setIsExpired(true);
                setIsEditing(false); // Force exit edit mode
                setTimeLeft("Expired");
                clearInterval(timer);
            } else {
                const minutes = Math.floor(diff / 60000);
                const seconds = Math.floor((diff % 60000) / 1000);
                setTimeLeft(`${minutes}:${seconds.toString().padStart(2, '0')}`);
            }
        }, 1000);

        return () => clearInterval(timer);
    }, [comment.created, comment.isEditable]);

    const handleSave = async () => {
        try {
            const request: UpdateCommentRequest = { content: editContent };
            const updated = await updateCommentCall(comment.id, request);
            onCommentUpdated(updated);
            setIsEditing(false);
            showMessage("Comment updated successfully");
        } catch (error) {
            console.error(error);
            showMessage("Failed to update comment");
        }
    };

    const handleDelete = async () => {
        if (!confirm("Are you sure you want to delete this comment?")) return;
        try {
            await deleteCommentCall(comment.id);
            onCommentDeleted(comment.id);
            showMessage("Comment deleted");
        } catch (error) {
            console.error(error);
            showMessage("Failed to delete comment");
        }
    };

    const handleViewHistory = async () => {
        if (!isModOrAdmin) return;
        setHistoryOpen(true);
        setHistoryLoading(true);
        try {
            const history = await getCommentHistoryCall(comment.id);
            setHistoryData(history);
        } catch (error) {
            console.error(error);
            showMessage("Failed to load history");
        } finally {
            setHistoryLoading(false);
        }
    };

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleString();
    };

    return (
        <Card sx={{ mb: 2, bgcolor: 'background.paper' }}>
            <CardContent>
                <Stack direction="row" spacing={2} alignItems="flex-start">
                    <Avatar src={comment.userAvatarUrl} alt={comment.userName} />
                    <Box sx={{ flexGrow: 1 }}>
                        <Stack direction="row" justifyContent="space-between" alignItems="center">
                            <Typography variant="subtitle2" fontWeight="bold">
                                {comment.userName}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                                {formatDate(comment.created)}
                            </Typography>
                        </Stack>

                        {isEditing ? (
                            <Box sx={{ mt: 1 }}>
                                <TextField
                                    fullWidth
                                    multiline
                                    rows={3}
                                    value={editContent}
                                    onChange={(e) => setEditContent(e.target.value)}
                                    size="small"
                                />
                                <Stack direction="row" spacing={1} sx={{ mt: 1 }} alignItems="center">
                                    <Button
                                        variant="contained"
                                        size="small"
                                        startIcon={<Save />}
                                        onClick={handleSave}
                                        disabled={isExpired}
                                    >
                                        Save
                                    </Button>
                                    <Button
                                        variant="outlined"
                                        size="small"
                                        startIcon={<Cancel />}
                                        onClick={() => setIsEditing(false)}
                                    >
                                        Cancel
                                    </Button>
                                    {!isExpired && (
                                        <Typography variant="caption" color="warning.main">
                                            Time left to edit: {timeLeft}
                                        </Typography>
                                    )}
                                </Stack>
                            </Box>
                        ) : (
                            <Box sx={{ mt: 1 }}>
                                <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                                    {comment.content}
                                </Typography>
                                {comment.lastEdited && (
                                    <Box sx={{ mt: 1, display: 'flex', alignItems: 'center' }}>
                                        <Typography variant="caption" color="text.secondary" fontStyle="italic">
                                            Edited {formatDate(comment.lastEdited)}
                                        </Typography>
                                        {(comment.history && comment.history.length > 0 || isModOrAdmin) && (
                                            <Tooltip title={isModOrAdmin ? "View Edit History" : "Edited"}>
                                                <IconButton
                                                    size="small"
                                                    onClick={handleViewHistory}
                                                    disabled={!isModOrAdmin}
                                                    sx={{ ml: 0.5, p: 0.5 }}
                                                >
                                                    <History fontSize="small" />
                                                </IconButton>
                                            </Tooltip>
                                        )}
                                    </Box>
                                )}
                            </Box>
                        )}
                    </Box>

                    {/* Actions */}
                    <Box>
                        {canModify && !isEditing && (
                            <Tooltip title={isExpired ? "Edit window (30m) expired" : "Edit"}>
                                <span>
                                    <IconButton
                                        size="small"
                                        onClick={() => setIsEditing(true)}
                                        disabled={isExpired}
                                    >
                                        <Edit fontSize="small" />
                                    </IconButton>
                                </span>
                            </Tooltip>
                        )}
                        {(comment.isOwner || isModOrAdmin) && (
                            <IconButton size="small" onClick={handleDelete} disabled={false}>
                                <Delete fontSize="small" />
                            </IconButton>
                        )}
                    </Box>
                </Stack>
            </CardContent>

            {/* History Dialog */}
            <Dialog open={historyOpen} onClose={() => setHistoryOpen(false)} maxWidth="sm" fullWidth>
                <DialogTitle>Edit History</DialogTitle>
                <DialogContent>
                    {historyLoading ? (
                        <Typography>Loading...</Typography>
                    ) : (
                        <List>
                            {historyData.map((item, index) => (
                                <ListItem key={index}>
                                    <ListItemText
                                        primary={item.content}
                                        secondary={`Edited at ${formatDate(item.editedAt)}`}
                                    />
                                </ListItem>
                            ))}
                            <Divider />
                            <ListItem>
                                <ListItemText
                                    primary={comment.content}
                                    secondary={`Current Version (Last edited: ${comment.lastEdited ? formatDate(comment.lastEdited) : 'Never'})`}
                                />
                            </ListItem>
                        </List>
                    )}
                </DialogContent>
            </Dialog>
        </Card>
    );
};
