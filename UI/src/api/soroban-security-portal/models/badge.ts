// Badge types for the Soroban Security Portal

export enum BadgeCategory {
    ACHIEVEMENT = 'achievement',
    CONTRIBUTION = 'contribution',
    SPECIAL = 'special',
}

export enum BadgeRarity {
    COMMON = 'common',
    RARE = 'rare',
    EPIC = 'epic',
    LEGENDARY = 'legendary',
}

export interface Badge {
    id: string;
    name: string;
    description: string;
    category: BadgeCategory;
    rarity: BadgeRarity;
    icon: string; // Icon name or URL
    color: string; // Hex color for the badge
}

export interface UserBadge extends Badge {
    awardedAt: Date;
    progress?: number; // 0-100 for in-progress badges
    isLocked?: boolean; // true if not yet earned
}

export interface BadgeProgress {
    badgeId: string;
    currentValue: number;
    targetValue: number;
    percentage: number;
}
