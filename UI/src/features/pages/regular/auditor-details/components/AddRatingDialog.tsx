import { FC, useState } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    Typography,
    Rating,
    TextField,
    Box,
    Stack,
} from '@mui/material';
import { AuditorRating } from '../../../../../api/soroban-security-portal/models/auditor';

interface AddRatingDialogProps {
    open: boolean;
    onClose: () => void;
    onSubmit: (rating: Partial<AuditorRating>) => Promise<void>;
    auditorName: string;
}

export const AddRatingDialog: FC<AddRatingDialogProps> = ({
    open,
    onClose,
    onSubmit,
    auditorName,
}) => {
    const [qualityScore, setQualityScore] = useState<number | null>(5);
    const [communicationScore, setCommunicationScore] = useState<number | null>(5);
    const [thoroughnessScore, setThoroughnessScore] = useState<number | null>(5);
    const [comment, setComment] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const handleSubmit = async () => {
        if (!qualityScore || !communicationScore || !thoroughnessScore) return;

        setSubmitting(true);
        try {
            await onSubmit({
                qualityScore,
                communicationScore,
                thoroughnessScore,
                comment,
            });
            onClose();
            // Reset form
            setQualityScore(5);
            setCommunicationScore(5);
            setThoroughnessScore(5);
            setComment('');
        } catch (error) {
            console.error('Failed to submit rating:', error);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
            <DialogTitle>Rate {auditorName}</DialogTitle>
            <DialogContent>
                <Stack spacing={3} sx={{ mt: 1 }}>
                    <Box>
                        <Typography component="legend">Audit Quality</Typography>
                        <Rating
                            value={qualityScore}
                            onChange={(_: any, newValue: number | null) => setQualityScore(newValue)}
                            size="large"
                        />
                    </Box>

                    <Box>
                        <Typography component="legend">Communication</Typography>
                        <Rating
                            value={communicationScore}
                            onChange={(_: any, newValue: number | null) => setCommunicationScore(newValue)}
                            size="large"
                        />
                    </Box>

                    <Box>
                        <Typography component="legend">Thoroughness</Typography>
                        <Rating
                            value={thoroughnessScore}
                            onChange={(_: any, newValue: number | null) => setThoroughnessScore(newValue)}
                            size="large"
                        />
                    </Box>

                    <TextField
                        label="Comments (optional)"
                        multiline
                        rows={4}
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                        fullWidth
                        placeholder="Share your experience with this auditor..."
                    />
                </Stack>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose} disabled={submitting}>
                    Cancel
                </Button>
                <Button
                    onClick={handleSubmit}
                    variant="contained"
                    disabled={submitting || !qualityScore || !communicationScore || !thoroughnessScore}
                >
                    {submitting ? 'Submitting...' : 'Submit Rating'}
                </Button>
            </DialogActions>
        </Dialog>
    );
};
