export enum TimePeriod {
    AllTime = 'All-Time',
    Year = 'This Year',
    Month = 'This Month',
    Week = 'This Week',
}

export enum LeaderboardCategory {
    Overall = 'Overall',
    Reports = 'Reports',
    Vulnerabilities = 'Vulnerabilities',
    Community = 'Community',
}

export interface LeaderboardEntry {
    rank: number;
    prevRank?: number; // For position change indicators
    userId: string;
    username: string;
    avatarUrl?: string;
    reputation: number;
    badgeCount: number;
    isCurrentUser?: boolean;
}

export interface LeaderboardFilters {
    period: TimePeriod;
    category: LeaderboardCategory;
}
