import { FC, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Button, Card, CardContent, CircularProgress, Stack, Typography } from '@mui/material';
import RateReviewRoundedIcon from '@mui/icons-material/RateReviewRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import LoginRoundedIcon from '@mui/icons-material/LoginRounded';
import { RatingEntityType } from '../../api/soroban-security-portal/models/rating';
import { useAppAuth } from '../../features/authentication/useAppAuth';
import { useRatings } from './useRatings';
import { RatingSummaryCard } from './RatingSummaryCard';
import { RatingDialog } from './RatingDialog';
import { ReviewList } from './ReviewList';

interface RatingsPanelProps {
  entityType: RatingEntityType;
  entityId: number;
}

const ENTITY_LABEL: Record<RatingEntityType, string> = {
  [RatingEntityType.Protocol]: 'protocol',
  [RatingEntityType.Auditor]: 'auditor',
};

/**
 * The full Reviews experience for a protocol or auditor: summary + distribution,
 * a call-to-action to rate (or log in), and the attributed review list.
 * Composed from entity-generic pieces so it drops onto either detail page.
 */
export const RatingsPanel: FC<RatingsPanelProps> = ({ entityType, entityId }) => {
  const { isAuthenticated } = useAppAuth();
  const navigate = useNavigate();
  const label = ENTITY_LABEL[entityType];
  const {
    summary, reviews, myRating, loading, loadingMore, submitting, submitError,
    loadMore, submit, remove, clearError,
  } = useRatings(entityType, entityId, isAuthenticated);

  const [dialogOpen, setDialogOpen] = useState(false);

  const openDialog = () => { clearError(); setDialogOpen(true); };

  const handleSubmit = async (score: number, review: string) => {
    const ok = await submit(score, review);
    if (ok) setDialogOpen(false);
  };

  const handleDelete = async () => {
    const ok = await remove();
    if (ok) setDialogOpen(false);
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Stack spacing={3}>
      <RatingSummaryCard summary={summary} />

      {/* Call to action */}
      <Card>
        <CardContent
          sx={{
            display: 'flex',
            flexDirection: { xs: 'column', sm: 'row' },
            alignItems: { xs: 'stretch', sm: 'center' },
            justifyContent: 'space-between',
            gap: 2,
          }}
        >
          <Box>
            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
              {myRating ? 'Your rating' : `Share your experience`}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {myRating
                ? `You rated this ${label} ${myRating.score}/5. You can update or remove it anytime.`
                : `Help others by rating this ${label} on security, docs and responsiveness.`}
            </Typography>
          </Box>
          {isAuthenticated ? (
            <Button
              variant="contained"
              startIcon={myRating ? <EditRoundedIcon /> : <RateReviewRoundedIcon />}
              onClick={openDialog}
              sx={{ flexShrink: 0 }}
            >
              {myRating ? 'Edit your rating' : 'Write a rating'}
            </Button>
          ) : (
            <Button
              variant="outlined"
              startIcon={<LoginRoundedIcon />}
              onClick={() => navigate('/login')}
              sx={{ flexShrink: 0 }}
            >
              Log in to rate
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Reviews */}
      <Card>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
            Reviews
          </Typography>
          <ReviewList
            reviews={reviews}
            total={summary?.totalReviews ?? 0}
            loadingMore={loadingMore}
            onLoadMore={loadMore}
            canFlag={isAuthenticated}
          />
        </CardContent>
      </Card>

      <RatingDialog
        open={dialogOpen}
        entityLabel={label}
        existing={myRating}
        submitting={submitting}
        error={submitError}
        onClose={() => setDialogOpen(false)}
        onSubmit={handleSubmit}
        onDelete={handleDelete}
      />
    </Stack>
  );
};
