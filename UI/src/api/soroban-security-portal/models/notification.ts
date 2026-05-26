export enum NotificationType { CommentReply = 1, Mention = 2 }
export enum NotificationEntityType { Protocol = 0, Auditor = 1, Vulnerability = 2, Report = 3 }

export interface Notification {
  id: number;
  type: NotificationType;
  actorUserId: number;
  actorName: string;
  commentId: number;
  entityType: NotificationEntityType;
  entityId: number;
  preview: string;
  isRead: boolean;
  createdAt: string;
}
