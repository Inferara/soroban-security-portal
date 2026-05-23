import { useState } from 'react';
import {
    Box, Paper, Typography, Button, Avatar, Chip,
    Collapse, TextField, Stack, useTheme
} from '@mui/material';
import {
    Check, Delete, VisibilityOff, AccessTime, OpenInNew
} from '@mui/icons-material';
import { Link as RouterLink } from 'react-router-dom';
import { FlaggedContent, FlagReason } from '../types';
import { environment } from '../../../environments/environment';
import { formatDistance } from 'date-fns';

interface ModerationItemProps {
    item: FlaggedContent;
    onAction: (id: string, action: 'approve' | 'hide' | 'delete', reason?: string) => void;
}

export const ModerationItem = ({ item, onAction }: ModerationItemProps) => {
    const theme = useTheme();
    const [actionReason, setActionReason] = useState('');
    const [showReasonInput, setShowReasonInput] = useState<'hide' | 'delete' | null>(null);

    // Link to the actual flagged content so a moderator can open it in context.
    const detailPath = `${environment.basePath}/${item.contentType === 'report' ? 'report' : 'vulnerability'}/${item.contentId}`;

    const handleConfirmAction = () => {
        if (showReasonInput && actionReason) {
            onAction(item.id, showReasonInput, actionReason);
            setShowReasonInput(null);
            setActionReason('');
        }
    };

    const getReasonColor = (reason: FlagReason) => {
        switch (reason) {
            case 'spam': return 'error';
            case 'harassment': return 'warning';
            case 'misinformation': return 'info';
            default: return 'default';
        }
    };

    return (
        <Paper elevation={0} sx={{ p: 3, border: `1px solid ${theme.palette.divider}`, mb: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                    <Avatar src={item.author.avatarUrl} alt={item.author.name} />
                    <Box>
                        <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
                            {item.author.name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                            Reputation: {item.author.reputationScore}
                        </Typography>
                    </Box>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Chip
                        icon={<AccessTime sx={{ fontSize: 16 }} />}
                        label={formatDistance(new Date(item.lastFlaggedAt), new Date(), { addSuffix: true })}
                        size="small"
                        variant="outlined"
                    />
                    <Chip
                        label={item.contentType}
                        size="small"
                        color="primary"
                    />
                    <Button
                        component={RouterLink}
                        to={detailPath}
                        target="_blank"
                        rel="noopener"
                        size="small"
                        variant="outlined"
                        endIcon={<OpenInNew sx={{ fontSize: 16 }} />}
                    >
                        View {item.contentType}
                    </Button>
                </Box>
            </Box>

            <Box sx={{ mb: 2, p: 2, bgcolor: theme.palette.action.hover, borderRadius: 2 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                    {item.contentPreview}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                    Use "View {item.contentType}" above to open the full content.
                </Typography>
            </Box>

            <Stack direction="row" spacing={1} sx={{ mb: 2, flexWrap: 'wrap', gap: 1 }}>
                <Typography variant="body2" sx={{ fontWeight: 'bold', mr: 1, alignSelf: 'center' }}>
                    Flags ({item.flagCount}):
                </Typography>
                {Object.entries(item.reasons)
                    .filter(([, count]) => count > 0)
                    .map(([reason, count]) => (
                        <Chip
                            key={reason}
                            label={`${reason} (${count})`}
                            size="small"
                            color={getReasonColor(reason as FlagReason)}
                            variant="outlined"
                        />
                    ))}
            </Stack>

            {item.flags && item.flags.length > 0 && (
                <Box sx={{ mb: 3 }}>
                    <Typography variant="body2" sx={{ fontWeight: 'bold', mb: 1 }}>
                        Reports:
                    </Typography>
                    <Stack spacing={1}>
                        {item.flags.map((f, i) => (
                            <Box key={i} sx={{ pl: 1.5, borderLeft: `3px solid ${theme.palette.divider}` }}>
                                <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'capitalize' }}>
                                    {f.reason}
                                </Typography>
                                <Typography
                                    variant="body2"
                                    sx={{ fontStyle: f.comment ? 'normal' : 'italic', color: f.comment ? 'text.primary' : 'text.secondary' }}
                                >
                                    {f.comment || 'No note provided'}
                                </Typography>
                            </Box>
                        ))}
                    </Stack>
                </Box>
            )}

            {item.status === 'pending' ? (
                <>
                    <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
                        <Button
                            startIcon={<Check />}
                            variant="outlined"
                            color="success"
                            onClick={() => onAction(item.id, 'approve')}
                        >
                            Approve
                        </Button>
                        <Button
                            startIcon={<VisibilityOff />}
                            variant="outlined"
                            color="warning"
                            onClick={() => setShowReasonInput(showReasonInput === 'hide' ? null : 'hide')}
                        >
                            Hide
                        </Button>
                        <Button
                            startIcon={<Delete />}
                            variant="outlined"
                            color="error"
                            onClick={() => setShowReasonInput(showReasonInput === 'delete' ? null : 'delete')}
                        >
                            Delete
                        </Button>
                    </Box>

                    <Collapse in={!!showReasonInput}>
                        <Box sx={{ mt: 2, pt: 2, borderTop: `1px dashed ${theme.palette.divider}` }}>
                            <Typography variant="subtitle2" sx={{ mb: 1 }}>
                                Reason for {showReasonInput === 'hide' ? 'hiding' : 'deleting'} content:
                            </Typography>
                            <Box sx={{ display: 'flex', gap: 2 }}>
                                <TextField
                                    fullWidth
                                    size="small"
                                    placeholder="Enter moderation reason..."
                                    value={actionReason}
                                    onChange={(e) => setActionReason(e.target.value)}
                                />
                                <Button
                                    variant="contained"
                                    color={showReasonInput === 'delete' ? 'error' : 'warning'}
                                    disabled={!actionReason}
                                    onClick={handleConfirmAction}
                                >
                                    Confirm
                                </Button>
                            </Box>
                        </Box>
                    </Collapse>
                </>
            ) : (
                <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 1 }}>
                    <Chip
                        label={`${item.status.charAt(0).toUpperCase() + item.status.slice(1)}${item.lastAction?.reason ? ` — ${item.lastAction.reason}` : ''}`}
                        color={item.status === 'approved' ? 'success' : item.status === 'hidden' ? 'warning' : 'error'}
                        variant="outlined"
                    />
                </Box>
            )}
        </Paper>
    );
};
