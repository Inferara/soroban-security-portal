import { useState } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    TextField,
    Box,
    Typography,
    CircularProgress,
} from '@mui/material';
import { StarRating } from './StarRating';

export interface RatingDialogProps {
    open: boolean;
    onClose: () => void;
    /** Called when the user submits; return a promise to show loading state */
    onSubmit: (rating: number, review: string) => Promise<void>;
    /** Title shown in the dialog header */
    title?: string;
    /** Initial star value */
    initialRating?: number;
    /** Initial review text */
    initialReview?: string;
}

export function RatingDialog({
    open,
    onClose,
    onSubmit,
    title = 'Submit Rating',
    initialRating = 0,
    initialReview = '',
}: RatingDialogProps) {
    const [rating, setRating] = useState(initialRating);
    const [review, setReview] = useState(initialReview);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    async function handleSubmit() {
        if (rating === 0) {
            setError('Please select a star rating.');
            return;
        }
        setError(null);
        setLoading(true);
        try {
            await onSubmit(rating, review.trim());
            handleClose();
        } catch {
            setError('Failed to submit rating. Please try again.');
        } finally {
            setLoading(false);
        }
    }

    function handleClose() {
        if (loading) return;
        setRating(initialRating);
        setReview(initialReview);
        setError(null);
        onClose();
    }

    return (
        <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
            <DialogTitle>{title}</DialogTitle>
            <DialogContent>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
                    <Box>
                        <Typography variant="body2" gutterBottom>
                            Your rating <span aria-hidden="true">*</span>
                        </Typography>
                        <StarRating
                            value={rating}
                            onChange={setRating}
                            size="large"
                            label="Your rating"
                        />
                        {error && rating === 0 && (
                            <Typography variant="caption" color="error" role="alert">
                                {error}
                            </Typography>
                        )}
                    </Box>
                    <TextField
                        label="Review (optional)"
                        multiline
                        minRows={3}
                        maxRows={8}
                        value={review}
                        onChange={(e) => setReview(e.target.value)}
                        inputProps={{ maxLength: 2000, 'aria-label': 'Review text' }}
                        helperText={`${review.length}/2000`}
                        disabled={loading}
                        fullWidth
                    />
                    {error && rating !== 0 && (
                        <Typography variant="caption" color="error" role="alert">
                            {error}
                        </Typography>
                    )}
                </Box>
            </DialogContent>
            <DialogActions>
                <Button onClick={handleClose} disabled={loading}>
                    Cancel
                </Button>
                <Button
                    variant="contained"
                    onClick={handleSubmit}
                    disabled={loading}
                    startIcon={loading ? <CircularProgress size={16} /> : undefined}
                >
                    {loading ? 'Submitting…' : 'Submit'}
                </Button>
            </DialogActions>
        </Dialog>
    );
}
