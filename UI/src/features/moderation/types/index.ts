export type ContentType = 'comment' | 'report' | 'user_profile' | 'vulnerability';

export type FlagReason = 'spam' | 'harassment' | 'inappropriate' | 'misinformation' | 'other';

export type ModerationStatus = 'pending' | 'approved' | 'hidden' | 'deleted';

export interface Author {
    id: string;
    name: string;
    avatarUrl?: string;
    email: string;
    reputationScore: number;
}

export interface FlaggedContent {
    id: string;
    contentType: ContentType;
    contentId: string;
    contentPreview: string; // Text snippet or title
    fullContent: string; // Full content for review
    author: Author;
    flagCount: number;
    reasons: Record<FlagReason, number>; // e.g. { spam: 2, harassment: 1 }
    firstFlaggedAt: string; // ISO Date
    lastFlaggedAt: string; // ISO Date
    status: ModerationStatus;
    moderationHistory: ModerationAction[];
}

export interface ModerationAction {
    id: string;
    moderatorId: string;
    moderatorName: string;
    action: ModerationStatus;
    reason?: string; // Required when hiding/deleting
    timestamp: string;
}

export interface ModerationStats {
    queueSize: number;
    actionsToday: number;
    actionsThisWeek: number;
    actionsThisMonth: number;
    flagBreakdown: Record<FlagReason, number>;
}

export interface ModerationFilters {
    status: ModerationStatus[];
    contentType: ContentType[];
    dateRange: { start: Date | null; end: Date | null };
}
