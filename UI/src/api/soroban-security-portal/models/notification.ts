export interface Notification {
    id: string;
    userId: string;
    type: NotificationType;
    title: string;
    message: string;
    link?: string;
    isRead: boolean;
    createdAt: string;
    actorName?: string;
    actorAvatarUrl?: string;
}

export enum NotificationType {
    Info = "Info",
    Warning = "Warning",
    Error = "Error",
    Success = "Success",
    Report = "Report",
    Vulnerability = "Vulnerability",
    Comment = "Comment"
}
