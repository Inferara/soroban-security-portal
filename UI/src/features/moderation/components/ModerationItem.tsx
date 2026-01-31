import { useState } from 'react';
import {
    Box, Paper, Typography, Button, Avatar, Chip,
    Collapse, TextField, Stack, useTheme
} from '@mui/material';
import {
    Check, Delete, VisibilityOff, ExpandMore,
    ExpandLess, AccessTime
} from '@mui/icons-material';
import { FlaggedContent, FlagReason } from '../types';
import { formatDistance } from 'date-fns';

interface ModerationItemProps {
    item: FlaggedContent;
    onAction: (id: string, action: 'approve' | 'hide' | 'delete', reason?: string) => void;
}

export const ModerationItem = ({ item, onAction }: ModerationItemProps) => {
    const theme = useTheme();
    const [expanded, setExpanded] = useState(false);
    const [actionReason, setActionReason] = useState('');
    const [showReasonInput, setShowReasonInput] = useState<'hide' | 'delete' | null>(null);

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
                        <Typography variant="subtitle1" fontWeight="bold">
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
                </Box>
            </Box>

            <Box sx={{ mb: 2, p: 2, bgcolor: theme.palette.action.hover, borderRadius: 2 }}>
                <Typography variant="body1">
                    {expanded ? item.fullContent : item.contentPreview}
                </Typography>
                {item.fullContent.length > item.contentPreview.length && (
                    <Button
                        size="small"
                        onClick={() => setExpanded(!expanded)}
                        endIcon={expanded ? <ExpandLess /> : <ExpandMore />}
                        sx={{ mt: 1 }}
                    >
                        {expanded ? 'Show Less' : 'Show More'}
                    </Button>
                )}
            </Box>

            <Stack direction="row" spacing={1} sx={{ mb: 3 }}>
                <Typography variant="body2" fontWeight="bold" sx={{ mr: 1, alignSelf: 'center' }}>
                    Flags ({item.flagCount}):
                </Typography>
                {Object.entries(item.reasons).map(([reason, count]) => (
                    <Chip
                        key={reason}
                        label={`${reason} (${count})`}
                        size="small"
                        color={getReasonColor(reason as FlagReason) as any}
                        variant="outlined"
                    />
                ))}
            </Stack>

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
        </Paper>
    );
};
