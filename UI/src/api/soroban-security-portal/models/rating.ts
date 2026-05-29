// Mirrors the backend rating contract (/api/v1/ratings). EntityType values match
// the backend EntityType enum (Protocol = 0, Auditor = 1).
export enum RatingEntityType {
  Protocol = 0,
  Auditor = 1,
}

export interface RatingSummary {
  entityType: RatingEntityType;
  entityId: number;
  averageScore: number;
  weightedAverageScore: number;
  totalReviews: number;
  // Keyed by star value "1".."5" -> count.
  distribution: Record<string, number>;
}

export interface PublicRating {
  id: number;
  entityType: RatingEntityType;
  entityId: number;
  score: number;
  review: string;
  createdAt: string;
  authorId: number;
  authorName: string;
}

export interface MyRating {
  id: number;
  score: number;
  review: string;
  createdAt: string;
}

export interface CreateRatingRequest {
  entityType: RatingEntityType;
  entityId: number;
  score: number;
  review: string;
}

// How many reviews the backend returns per page (matches RatingService default).
export const RATING_PAGE_SIZE = 10;
