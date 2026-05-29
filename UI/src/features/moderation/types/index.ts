// Vulnerabilities, reports, ratings/reviews and comments can be flagged/moderated.
// Keep this in sync with the backend ModeratedContentType enum.
export type ContentType = 'report' | 'vulnerability' | 'rating' | 'comment';

export type FlagReason = 'spam' | 'harassment' | 'inappropriate' | 'misinformation' | 'other';

export type ModerationStatus = 'pending' | 'approved' | 'hidden' | 'deleted';

export interface Author {
    id: string;
    name: string;
    avatarUrl?: string;
    email: string;
    reputationScore: number;
}

export interface ContentFlagDetail {
    reason: string;
    comment?: string;
    createdAt: string;
}

export interface FlaggedContent {
    id: string;
    contentType: ContentType;
    contentId: string;
    contentPreview: string; // Text snippet or title
    fullContent: string; // Full content for review
    // Navigable parent page (e.g. type "vulnerability" id 4, or "protocol" id 17).
    // Comments point at their vuln/report discussion; ratings at the protocol/auditor.
    contextType?: string;
    contextId?: number;
    author: Author;
    flagCount: number;
    reasons: Record<FlagReason, number>; // e.g. { spam: 2, harassment: 1 }
    flags?: ContentFlagDetail[]; // individual reports: each flagger's reason + note
    firstFlaggedAt: string; // ISO Date
    lastFlaggedAt: string; // ISO Date
    status: ModerationStatus;
    moderationHistory: ModerationAction[];
    lastAction?: { action: 'approve' | 'hide' | 'delete'; reason?: string };
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
}

export interface ModerationFilters {
    status: ModerationStatus[];
    contentType: ContentType[];
    dateRange: { start: Date | null; end: Date | null };
}
