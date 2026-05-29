import { useCallback, useEffect, useState } from 'react';
import {
  addOrUpdateRatingCall,
  deleteRatingCall,
  getMyRatingCall,
  getRatingsCall,
  getRatingSummaryCall,
} from '../../api/soroban-security-portal/soroban-security-portal-api';
import {
  MyRating,
  PublicRating,
  RatingEntityType,
  RatingSummary,
} from '../../api/soroban-security-portal/models/rating';

interface UseRatingsResult {
  summary: RatingSummary | null;
  reviews: PublicRating[];
  myRating: MyRating | null;
  loading: boolean;
  loadingMore: boolean;
  submitting: boolean;
  submitError: string | null;
  hasMore: boolean;
  loadMore: () => Promise<void>;
  submit: (score: number, review: string) => Promise<boolean>;
  remove: () => Promise<boolean>;
  clearError: () => void;
}

/**
 * Loads and mutates ratings for a single entity. Summary + first page of reviews
 * load on mount; the caller's own rating is only fetched when authenticated.
 */
export const useRatings = (
  entityType: RatingEntityType,
  entityId: number,
  isAuthenticated: boolean,
): UseRatingsResult => {
  const [summary, setSummary] = useState<RatingSummary | null>(null);
  const [reviews, setReviews] = useState<PublicRating[]>([]);
  const [myRating, setMyRating] = useState<MyRating | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const loadCore = useCallback(async () => {
    const [summaryData, reviewsData] = await Promise.all([
      getRatingSummaryCall(entityType, entityId),
      getRatingsCall(entityType, entityId, 1),
    ]);
    setSummary(summaryData);
    setReviews(reviewsData);
    setPage(1);

    if (isAuthenticated) {
      const mine = await getMyRatingCall(entityType, entityId).catch(() => null);
      setMyRating(mine);
    } else {
      setMyRating(null);
    }
  }, [entityType, entityId, isAuthenticated]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    loadCore()
      .catch(() => { /* errors are surfaced globally by the rest client */ })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [loadCore]);

  const loadMore = useCallback(async () => {
    setLoadingMore(true);
    try {
      const next = page + 1;
      const more = await getRatingsCall(entityType, entityId, next);
      setReviews((prev) => [...prev, ...more]);
      setPage(next);
    } finally {
      setLoadingMore(false);
    }
  }, [entityType, entityId, page]);

  const submit = useCallback(async (score: number, review: string): Promise<boolean> => {
    setSubmitting(true);
    setSubmitError(null);
    try {
      await addOrUpdateRatingCall({ entityType, entityId, score, review });
      await loadCore();
      return true;
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : 'Could not save your rating.');
      return false;
    } finally {
      setSubmitting(false);
    }
  }, [entityType, entityId, loadCore]);

  const remove = useCallback(async (): Promise<boolean> => {
    if (!myRating) return false;
    setSubmitting(true);
    setSubmitError(null);
    try {
      await deleteRatingCall(myRating.id);
      await loadCore();
      return true;
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : 'Could not delete your rating.');
      return false;
    } finally {
      setSubmitting(false);
    }
  }, [myRating, loadCore]);

  const clearError = useCallback(() => setSubmitError(null), []);

  return {
    summary,
    reviews,
    myRating,
    loading,
    loadingMore,
    submitting,
    submitError,
    hasMore: !!summary && reviews.length < summary.totalReviews,
    loadMore,
    submit,
    remove,
    clearError,
  };
};
