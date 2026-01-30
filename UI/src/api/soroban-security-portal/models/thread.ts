export interface ThreadReply {
    id: number;
    content: string;
    createdBy: number;
    createdByName: string;
    createdAt: string;
}

export interface Thread {
    id: number;
    vulnerabilityId: number;
    createdAt: string;
    createdBy: number;
    replies: ThreadReply[];
    isUserWatching: boolean;
}

export interface Notification {
    id: number;
    message: string;
    link: string;
    type: string;
    threadId?: number;
    isRead: boolean;
    createdAt: string;
}
