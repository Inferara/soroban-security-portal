import { FC, useState, useEffect, useCallback } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Rating,
  Button,
  TextField,
  Divider,
  LinearProgress,
  Stack,
  Alert,
} from '@mui/material';
import { Star } from '@mui/icons-material';
import {
  RatingItem,
  RatingSummary,
  CreateRatingRequest,
  EntityType,
} from '../../api/soroban-security-portal/models/rating';
import {
  getRatingSummaryCall,
  getRatingsCall,
  createOrUpdateRatingCall,
} from '../../api/soroban-security-portal/soroban-security-portal-api';
import { useAppAuth } from '../../features/authentication/useAppAuth';
import { formatDateLong } from '../../utils';

export interface RatingSectionProps {
  entityType: EntityType;
  entityId: number;
  entityName: string;
}

const DIMENSIONS = [
  { key: 'quality', label: 'Quality' },
  { key: 'communication', label: 'Communication' },
  { key: 'thoroughness', label: 'Thoroughness' },
] as const;

type DimensionKey = typeof DIMENSIONS[number]['key'];

export const RatingSection: FC<RatingSectionProps> = ({ entityType, entityId, entityName }) => {
  const { isAuthenticated } = useAppAuth();

  const [summary, setSummary] = useState<RatingSummary | null>(null);
  const [ratings, setRatings] = useState<RatingItem[]>([]);

  const [dimensionScores, setDimensionScores] = useState<Record<DimensionKey, number | null>>({
    quality: null,
    communication: null,
    thoroughness: null,
  });
  const [review, setReview] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [summaryData, ratingsData] = await Promise.all([
        getRatingSummaryCall(entityType, entityId),
        getRatingsCall(entityType, entityId),
      ]);
      setSummary(summaryData);
      setRatings(ratingsData);
    } catch (err) {
      console.error('Error fetching ratings:', err);
    }
  }, [entityType, entityId]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const handleDimensionChange = (key: DimensionKey, value: number | null) => {
    setDimensionScores(prev => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async () => {
    const scores = Object.values(dimensionScores);
    if (scores.some(s => !s)) {
      setSubmitError('Please rate all three dimensions before submitting.');
      return;
    }

    const total = scores.reduce<number>((sum, s) => sum + (s ?? 0), 0);
    const aggregatedScore = Math.round(total / scores.length);

    const request: CreateRatingRequest = {
      entityType,
      entityId,
      score: aggregatedScore,
      review,
    };

    try {
      setSubmitting(true);
      setSubmitError(null);
      await createOrUpdateRatingCall(request);
      setSubmitSuccess(true);
      setDimensionScores({ quality: null, communication: null, thoroughness: null });
      setReview('');
      await fetchData();
      setTimeout(() => setSubmitSuccess(false), 3000);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to submit rating.');
    } finally {
      setSubmitting(false);
    }
  };

  const averageScore = summary?.averageScore ?? 0;
  const totalReviews = summary?.totalReviews ?? 0;

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
          <Star sx={{ mr: 1, verticalAlign: 'middle', color: 'warning.main' }} />
          Ratings & Reviews
        </Typography>

        {/* Summary */}
        <Box sx={{ display: 'flex', gap: 3, mb: 3, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <Box sx={{ textAlign: 'center', minWidth: 90 }}>
            <Typography variant="h3" sx={{ fontWeight: 700, color: 'warning.main', lineHeight: 1 }}>
              {averageScore > 0 ? averageScore.toFixed(1) : '—'}
            </Typography>
            <Rating value={averageScore} precision={0.1} readOnly size="small" sx={{ mt: 0.5 }} />
            <Typography variant="caption" color="text.secondary" display="block">
              {totalReviews} {totalReviews === 1 ? 'review' : 'reviews'}
            </Typography>
          </Box>

          {totalReviews > 0 && (
            <Box sx={{ flex: 1, minWidth: 160 }}>
              {[5, 4, 3, 2, 1].map(star => {
                const count = summary?.distribution?.[star] ?? 0;
                const percent = totalReviews > 0 ? (count / totalReviews) * 100 : 0;
                return (
                  <Box key={star} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                    <Typography variant="caption" sx={{ minWidth: 8 }}>{star}</Typography>
                    <Star sx={{ fontSize: 13, color: 'warning.main' }} />
                    <LinearProgress
                      variant="determinate"
                      value={percent}
                      sx={{ flex: 1, height: 8, borderRadius: 4 }}
                    />
                    <Typography variant="caption" color="text.secondary" sx={{ minWidth: 16 }}>
                      {count}
                    </Typography>
                  </Box>
                );
              })}
            </Box>
          )}
        </Box>

        <Divider sx={{ mb: 3 }} />

        {/* Rating form */}
        {isAuthenticated ? (
          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>
              Rate {entityName}
            </Typography>

            {submitSuccess && (
              <Alert severity="success" sx={{ mb: 2 }}>
                Your rating has been submitted!
              </Alert>
            )}
            {submitError && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {submitError}
              </Alert>
            )}

            <Stack spacing={1.5} sx={{ mb: 2 }}>
              {DIMENSIONS.map(({ key, label }) => (
                <Box key={key} sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Typography variant="body2" sx={{ minWidth: 130, fontWeight: 500 }}>
                    {label}
                  </Typography>
                  <Rating
                    value={dimensionScores[key]}
                    onChange={(_, newValue) => handleDimensionChange(key, newValue)}
                  />
                </Box>
              ))}
            </Stack>

            <TextField
              fullWidth
              multiline
              rows={3}
              label="Review (optional)"
              value={review}
              onChange={e => setReview(e.target.value)}
              sx={{ mb: 2 }}
              inputProps={{ maxLength: 2000 }}
            />

            <Button
              variant="contained"
              onClick={handleSubmit}
              disabled={submitting}
            >
              {submitting ? 'Submitting…' : 'Submit Rating'}
            </Button>
          </Box>
        ) : (
          <Box sx={{ mb: 3, py: 2, textAlign: 'center' }}>
            <Typography color="text.secondary">
              Log in to rate this {entityType === EntityType.Auditor ? 'auditor' : 'protocol'}.
            </Typography>
          </Box>
        )}

        <Divider sx={{ mb: 2 }} />

        {/* Reviews list */}
        {ratings.length > 0 ? (
          <Stack spacing={2}>
            {ratings.map(rating => (
              <Box key={rating.id}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                  <Rating value={rating.score} readOnly size="small" />
                  <Typography variant="caption" color="text.secondary">
                    {formatDateLong(rating.createdAt)}
                  </Typography>
                </Box>
                {rating.review && (
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                    {rating.review}
                  </Typography>
                )}
              </Box>
            ))}
          </Stack>
        ) : (
          <Typography color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
            No reviews yet. Be the first to rate!
          </Typography>
        )}
      </CardContent>
    </Card>
  );
};
