import { FC } from 'react';
import { Box, Button, Divider, Stack, Typography } from '@mui/material';
import { EntityAvatar } from '../EntityAvatar';
import { FlagButton } from '../FlagButton';
import { RatingStars } from './RatingStars';
import { PublicRating } from '../../api/soroban-security-portal/models/rating';
import { formatDateLong } from '../../utils';

interface ReviewListProps {
  reviews: PublicRating[];
  total: number;
  loadingMore: boolean;
  onLoadMore: () => void;
  /** Show the "report" flag on each review (only when the viewer is signed in). */
  canFlag?: boolean;
  /** The signed-in viewer's own rating id, if any — the flag is hidden on their own review. */
  ownRatingId?: number;
}

/**
 * Recent reviews, each attributed to its author (public avatar + display name).
 * Review text is rendered as plain text — React escapes it, so user content
 * cannot inject markup. A "Load more" button appears while more remain.
 */
export const ReviewList: FC<ReviewListProps> = ({ reviews, total, loadingMore, onLoadMore, canFlag = false, ownRatingId }) => {
  if (reviews.length === 0) {
    return (
      <Typography color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
        No written reviews yet.
      </Typography>
    );
  }

  return (
    <Box>
      <Stack divider={<Divider flexItem />} spacing={2.5}>
        {reviews.map((r) => (
          <Box key={r.id} sx={{ display: 'flex', gap: 2 }}>
            <EntityAvatar
              entityType="user"
              entityId={r.authorId}
              size="medium"
              fallbackText={r.authorName}
              loadingStyle="fade"
            />
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Box
                sx={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 1,
                }}
              >
                <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                  {r.authorName || 'Anonymous'}
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Typography variant="caption" color="text.secondary">
                    {formatDateLong(r.createdAt)}
                  </Typography>
                  {canFlag && r.id !== ownRatingId && <FlagButton contentType="rating" contentId={r.id} />}
                </Box>
              </Box>
              <RatingStars value={r.score} readOnly size="small" sx={{ mt: 0.25 }} />
              {r.review?.trim() && (
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ mt: 0.75, whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: 1.6 }}
                >
                  {r.review}
                </Typography>
              )}
            </Box>
          </Box>
        ))}
      </Stack>

      {reviews.length < total && (
        <Box sx={{ textAlign: 'center', mt: 3 }}>
          <Button variant="outlined" onClick={onLoadMore} disabled={loadingMore}>
            {loadingMore ? 'Loading…' : `Load more (${total - reviews.length} more)`}
          </Button>
        </Box>
      )}
    </Box>
  );
};
