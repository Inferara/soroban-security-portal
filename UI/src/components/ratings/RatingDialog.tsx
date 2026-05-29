import { FC, useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import { RatingStars } from './RatingStars';
import { MyRating } from '../../api/soroban-security-portal/models/rating';

const MAX_REVIEW = 2000;
const LABELS: Record<number, string> = {
  1: 'Poor', 2: 'Fair', 3: 'Good', 4: 'Very good', 5: 'Excellent',
};

interface RatingDialogProps {
  open: boolean;
  entityLabel: string; // e.g. "protocol" / "auditor"
  existing: MyRating | null;
  submitting: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (score: number, review: string) => void;
  onDelete: () => void;
}

/**
 * Create / update / delete the current user's rating. Prefills from any existing
 * rating, enforces a 1-5 score and the 2000-char review cap, and surfaces server
 * errors inline so the dialog stays open for a retry.
 */
export const RatingDialog: FC<RatingDialogProps> = ({
  open, entityLabel, existing, submitting, error, onClose, onSubmit, onDelete,
}) => {
  const [score, setScore] = useState<number>(0);
  const [hover, setHover] = useState<number>(-1);
  const [review, setReview] = useState<string>('');

  // Reset the form whenever the dialog opens (prefill from the existing rating).
  useEffect(() => {
    if (open) {
      setScore(existing?.score ?? 0);
      setReview(existing?.review ?? '');
      setHover(-1);
    }
  }, [open, existing]);

  const activeLabel = hover !== -1 ? hover : score;
  const isEditing = !!existing;

  return (
    <Dialog open={open} onClose={submitting ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ pr: 6 }}>
        {isEditing ? 'Update your rating' : `Rate this ${entityLabel}`}
        <IconButton
          aria-label="close"
          onClick={onClose}
          disabled={submitting}
          sx={{ position: 'absolute', right: 8, top: 8 }}
        >
          <CloseRoundedIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers>
        <Stack spacing={2} sx={{ alignItems: 'center', py: 1 }}>
          <RatingStars
            value={score}
            size="large"
            glow
            sx={{ fontSize: '2.75rem' }}
            onChange={(_, v) => setScore(v ?? 0)}
            onChangeActive={(_, v) => setHover(v)}
          />
          <Typography variant="subtitle1" sx={{ minHeight: 28, fontWeight: 600 }}>
            {activeLabel > 0 ? LABELS[activeLabel] : 'Tap a star to rate'}
          </Typography>

          <TextField
            label="Add a review (optional)"
            placeholder="What stood out about its security, documentation, responsiveness…?"
            multiline
            minRows={3}
            fullWidth
            value={review}
            onChange={(e) => setReview(e.target.value.slice(0, MAX_REVIEW))}
            helperText={`${review.length}/${MAX_REVIEW}`}
            slotProps={{
              htmlInput: { maxLength: MAX_REVIEW },
              formHelperText: { sx: { textAlign: 'right', m: 0, mt: 0.5 } },
            }}
          />

          {error && <Alert severity="error" sx={{ width: '100%' }}>{error}</Alert>}
        </Stack>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2, justifyContent: isEditing ? 'space-between' : 'flex-end' }}>
        {isEditing && (
          <Button
            color="error"
            startIcon={<DeleteOutlineRoundedIcon />}
            onClick={onDelete}
            disabled={submitting}
          >
            Delete
          </Button>
        )}
        <Box>
          <Button onClick={onClose} disabled={submitting} sx={{ mr: 1 }}>Cancel</Button>
          <Button
            variant="contained"
            onClick={() => onSubmit(score, review)}
            disabled={submitting || score < 1}
            startIcon={submitting ? <CircularProgress size={16} color="inherit" /> : undefined}
          >
            {isEditing ? 'Update' : 'Submit'}
          </Button>
        </Box>
      </DialogActions>
    </Dialog>
  );
};
