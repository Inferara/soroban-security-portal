import { FC, useState } from 'react';
import {
    IconButton,
    Tooltip,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    Select,
    MenuItem,
    TextField,
    FormControl,
    InputLabel,
    Stack,
    SelectChangeEvent,
} from '@mui/material';
import OutlinedFlagIcon from '@mui/icons-material/OutlinedFlag';
import FlagIcon from '@mui/icons-material/Flag';
import { flagContentCall } from '../api/soroban-security-portal/soroban-security-portal-api';
import { showError } from '../features/dialog-handler/dialog-handler';

interface FlagButtonProps {
    contentType: 'vulnerability' | 'report';
    contentId: number;
}

const REASON_OPTIONS: { value: string; label: string }[] = [
    { value: 'spam', label: 'Spam' },
    { value: 'harassment', label: 'Harassment' },
    { value: 'inappropriate', label: 'Inappropriate' },
    { value: 'misinformation', label: 'Misinformation' },
    { value: 'other', label: 'Other' },
];

export const FlagButton: FC<FlagButtonProps> = ({ contentType, contentId }) => {
    const [dialogOpen, setDialogOpen] = useState(false);
    const [reason, setReason] = useState('spam');
    const [comment, setComment] = useState('');
    const [reported, setReported] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    const handleOpenDialog = (e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
        if (!reported) {
            setDialogOpen(true);
        }
    };

    const handleCancel = () => {
        setDialogOpen(false);
        setReason('spam');
        setComment('');
    };

    const handleReport = async () => {
        setSubmitting(true);
        try {
            await flagContentCall(contentType, contentId, reason, comment || undefined);
            setReported(true);
            setDialogOpen(false);
        } catch (err: unknown) {
            const status = (err as { response?: { status?: number } })?.response?.status;
            if (status === 409) {
                // Already reported by this user — treat as success silently
                setReported(true);
                setDialogOpen(false);
            } else {
                const message =
                    (err as { message?: string })?.message ?? 'Failed to report content.';
                showError(message);
                setDialogOpen(false);
            }
        } finally {
            setSubmitting(false);
        }
    };

    const tooltipText = reported ? 'Reported' : 'Report content';

    return (
        <>
            <Tooltip title={tooltipText} arrow>
                <span>
                    <IconButton
                        onClick={handleOpenDialog}
                        disabled={reported}
                        sx={{
                            color: 'action.active',
                            '&:hover': {
                                color: 'error.main',
                            },
                        }}
                        aria-label={tooltipText}
                    >
                        {reported ? <FlagIcon color="error" /> : <OutlinedFlagIcon />}
                    </IconButton>
                </span>
            </Tooltip>

            <Dialog open={dialogOpen} onClose={handleCancel} fullWidth maxWidth="xs">
                <DialogTitle>Report content</DialogTitle>
                <DialogContent>
                    <Stack spacing={2} sx={{ mt: 1 }}>
                        <FormControl fullWidth>
                            <InputLabel id="flag-reason-label">Reason</InputLabel>
                            <Select
                                labelId="flag-reason-label"
                                id="flag-reason-select"
                                value={reason}
                                label="Reason"
                                onChange={(e: SelectChangeEvent) => setReason(e.target.value)}
                            >
                                {REASON_OPTIONS.map((opt) => (
                                    <MenuItem key={opt.value} value={opt.value}>
                                        {opt.label}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                        <TextField
                            label="Comment (optional)"
                            multiline
                            rows={3}
                            value={comment}
                            onChange={(e) => setComment(e.target.value)}
                            fullWidth
                        />
                    </Stack>
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleCancel} disabled={submitting}>
                        Cancel
                    </Button>
                    <Button onClick={handleReport} disabled={submitting} variant="contained" color="error">
                        Report
                    </Button>
                </DialogActions>
            </Dialog>
        </>
    );
};
