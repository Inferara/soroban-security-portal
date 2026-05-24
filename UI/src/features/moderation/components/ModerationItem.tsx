import { useState } from 'react';
import {
    Box, Paper, Typography, Button, Avatar, Chip,
    Collapse, TextField, Stack, Link, useTheme
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

    // The global theme forces every Button to a heavy blue; override per-action so the
    // three moderation choices read as distinct (positive / neutral / destructive).
    const baseBtn = { fontWeight: 600, fontSize: '0.8125rem', boxShadow: 'none' };
    const approveSx = {
        ...baseBtn, bgcolor: 'success.main', color: '#fff',
        '&:hover': { bgcolor: 'success.dark', boxShadow: 'none' },
    };
    const hideSx = {
        ...baseBtn, bgcolor: 'transparent', color: 'text.secondary', border: '1px solid', borderColor: 'divider',
        '&:hover': { bgcolor: 'action.hover', borderColor: 'text.secondary', color: 'text.primary' },
    };
    const deleteSx = {
        ...baseBtn, bgcolor: 'transparent', color: 'error.main', border: '1px solid', borderColor: 'error.main',
        '&:hover': { bgcolor: 'error.main', color: '#fff' },
    };
    const confirmSx = showReasonInput === 'delete'
        ? { ...baseBtn, bgcolor: 'error.main', color: '#fff', '&:hover': { bgcolor: 'error.dark' } }
        : { ...baseBtn, bgcolor: 'warning.main', color: '#fff', '&:hover': { bgcolor: 'warning.dark' } };

    return (
        <Paper elevation={0} sx={{ p: 2.5, border: `1px solid ${theme.palette.divider}`, borderRadius: 2, mb: 2 }}>
            {/* Header: who is involved + when/what — compact and muted */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2, mb: 1.5 }}>
                <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', minWidth: 0 }}>
                    <Avatar src={item.author.avatarUrl} alt={item.author.name} sx={{ width: 40, height: 40 }} />
                    <Box sx={{ minWidth: 0 }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 700, lineHeight: 1.2 }} noWrap>
                            {item.author.name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" noWrap>
                            Reputation {item.author.reputationScore}
                        </Typography>
                    </Box>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, flexShrink: 0 }}>
                    <Chip
                        label={item.contentType}
                        size="small"
                        sx={{ textTransform: 'capitalize', bgcolor: 'action.selected', color: 'text.secondary', fontWeight: 600 }}
                    />
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: 'text.secondary' }}>
                        <AccessTime sx={{ fontSize: 14 }} />
                        <Typography variant="caption" noWrap>
                            {formatDistance(new Date(item.lastFlaggedAt), new Date(), { addSuffix: true })}
                        </Typography>
                    </Box>
                </Box>
            </Box>

            {/* The flagged content — the title is the link that opens it in context */}
            <Link
                component={RouterLink}
                to={detailPath}
                target="_blank"
                rel="noopener"
                underline="hover"
                sx={{
                    display: 'inline-flex', alignItems: 'center', gap: 0.5,
                    color: 'text.primary', fontWeight: 600, fontSize: '1.05rem', lineHeight: 1.35,
                    '&:hover': { color: 'secondary.main' },
                }}
            >
                {item.contentPreview}
                <OpenInNew sx={{ fontSize: 16, opacity: 0.7, flexShrink: 0 }} />
            </Link>

            {/* Flag summary */}
            <Box sx={{ display: 'flex', alignItems: 'center', mt: 2, mb: 1.5, flexWrap: 'wrap', gap: 1 }}>
                <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    {item.flagCount} {item.flagCount === 1 ? 'report' : 'reports'}
                </Typography>
                {Object.entries(item.reasons)
                    .filter(([, count]) => count > 0)
                    .map(([reason, count]) => (
                        <Chip
                            key={reason}
                            label={`${reason} ${count}`}
                            size="small"
                            color={getReasonColor(reason as FlagReason)}
                            variant="outlined"
                            sx={{ textTransform: 'capitalize' }}
                        />
                    ))}
            </Box>

            {/* Each report: reason + the note the flagger wrote */}
            {item.flags && item.flags.length > 0 && (
                <Stack spacing={1.25} sx={{ mb: 2.5 }}>
                    {item.flags.map((f, i) => (
                        <Box key={i} sx={{ pl: 1.5, borderLeft: `2px solid ${theme.palette.divider}` }}>
                            <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', textTransform: 'capitalize' }}>
                                {f.reason}
                            </Typography>
                            <Typography
                                variant="body2"
                                sx={{ color: f.comment ? 'text.primary' : 'text.disabled', fontStyle: f.comment ? 'normal' : 'italic' }}
                            >
                                {f.comment || 'No note provided'}
                            </Typography>
                        </Box>
                    ))}
                </Stack>
            )}

            {/* Actions (pending) or the resolution chip (history) */}
            {item.status === 'pending' ? (
                <>
                    <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1.5 }}>
                        <Button size="small" startIcon={<Check />} onClick={() => onAction(item.id, 'approve')} sx={approveSx}>
                            Approve
                        </Button>
                        <Button size="small" startIcon={<VisibilityOff />} onClick={() => setShowReasonInput(showReasonInput === 'hide' ? null : 'hide')} sx={hideSx}>
                            Hide
                        </Button>
                        <Button size="small" startIcon={<Delete />} onClick={() => setShowReasonInput(showReasonInput === 'delete' ? null : 'delete')} sx={deleteSx}>
                            Delete
                        </Button>
                    </Box>

                    <Collapse in={!!showReasonInput}>
                        <Box sx={{ mt: 2, pt: 2, borderTop: `1px dashed ${theme.palette.divider}` }}>
                            <Typography variant="subtitle2" sx={{ mb: 1 }}>
                                Reason for {showReasonInput === 'hide' ? 'hiding' : 'deleting'} this content:
                            </Typography>
                            <Box sx={{ display: 'flex', gap: 1.5 }}>
                                <TextField
                                    fullWidth
                                    size="small"
                                    placeholder="Enter moderation reason..."
                                    value={actionReason}
                                    onChange={(e) => setActionReason(e.target.value)}
                                />
                                <Button disabled={!actionReason} onClick={handleConfirmAction} sx={confirmSx}>
                                    Confirm
                                </Button>
                            </Box>
                        </Box>
                    </Collapse>
                </>
            ) : (
                <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <Chip
                        label={`${item.status.charAt(0).toUpperCase() + item.status.slice(1)}${item.lastAction?.reason ? ` — ${item.lastAction.reason}` : ''}`}
                        color={item.status === 'approved' ? 'success' : item.status === 'hidden' ? 'warning' : 'error'}
                        variant="outlined"
                        size="small"
                    />
                </Box>
            )}
        </Paper>
    );
};
