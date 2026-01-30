export interface AuditorRating {
  id: number;
  auditorId: number;
  qualityScore: number;
  communicationScore: number;
  thoroughnessScore: number;
  comment?: string;
  createdBy: number;
  createdByName?: string;
  createdAt: string;
  averageScore: number;
}

export interface AuditorItem {
  id: number;
  name: string;
  description: string;
  image?: string;
  url: string;
  date: Date;
  createdBy: string;
  averageRating?: number;
  ratingCount?: number;
  ratings?: AuditorRating[];
}