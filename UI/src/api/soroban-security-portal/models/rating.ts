export enum EntityType {
  Protocol = 0,
  Auditor = 1,
}

export interface RatingItem {
  id: number;
  userId: number;
  entityType: EntityType;
  entityId: number;
  score: number;
  review: string;
  createdAt: Date;
}

export interface CreateRatingRequest {
  entityType: EntityType;
  entityId: number;
  score: number;
  review: string;
}

export interface RatingSummary {
  entityType: EntityType;
  entityId: number;
  averageScore: number;
  totalReviews: number;
  distribution: { [key: number]: number };
}
