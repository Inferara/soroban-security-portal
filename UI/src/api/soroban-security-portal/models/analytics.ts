// Mirrors the backend EntityType enum (Protocol=0, Auditor=1, Vulnerability=2, Report=3).
export enum PageViewEntityType {
  Protocol = 0,
  Auditor = 1,
  Vulnerability = 2,
  Report = 3,
}

export interface PageViewCount {
  total: number;
  today: number;
  unique: number;
}

export interface AnalyticsTopEntity {
  entityType: PageViewEntityType;
  entityId: number;
  title: string;
  views: number;
}

export interface AnalyticsDailyViews {
  date: string;
  views: number;
}

export interface AnalyticsStatistics {
  totalHumanViews: number;
  uniqueVisitors: number;
  crawlerShares: number;
  topEntities: AnalyticsTopEntity[];
  daily: AnalyticsDailyViews[];
}
