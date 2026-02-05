export enum ReferenceType {
    Report = 1,
    Protocol = 2,
    Auditor = 3,
    Vulnerability = 4
}

export interface CommentHistoryItem {
    content: string;
    editedAt: string;
}

export interface CommentItem {
    id: number;
    userId: number;
    userName: string;
    userAvatarUrl?: string;
    referenceId: number;
    referenceType: ReferenceType;
    content: string;
    history: CommentHistoryItem[];
    created: string;
    lastEdited?: string;
    isDeleted: boolean;
    isEditable: boolean;
    isOwner: boolean;
}

export interface CreateCommentRequest {
    referenceId: number;
    referenceType: ReferenceType;
    content: string;
}

export interface UpdateCommentRequest {
    content: string;
}
