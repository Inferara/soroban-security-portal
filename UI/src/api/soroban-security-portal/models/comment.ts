export enum CommentEntityType {
  Report = 1,
  Vulnerability = 2,
}

export interface Comment {
  id: number;
  entityType: CommentEntityType;
  entityId: number;
  userId: number;
  userName: string;
  userAvatar?: string;
  content: string;
  createdAt: string;
  updatedAt?: string;
}

export interface CreateComment {
  entityType: CommentEntityType;
  entityId: number;
  content: string;
}

export interface UpdateComment {
  id: number;
  content: string;
}
