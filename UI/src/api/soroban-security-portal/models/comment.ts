// Mirrors the backend /api/v1/comments contract. EntityType values match the backend
// EntityType enum (Vulnerability = 2, Report = 3 — comments attach to these).
export enum CommentEntityType {
  Vulnerability = 2,
  Report = 3,
}

export interface Comment {
  id: number;
  entityType: CommentEntityType;
  entityId: number;
  parentCommentId: number | null;
  content: string;
  contentHtml: string;
  authorId: number;
  authorName: string;
  upvoteCount: number;
  downvoteCount: number;
  isEdited: boolean;
  createdAt: string;
  updatedAt: string | null;
  replyCount: number;
  replies: Comment[];
  currentUserVote: string | null; // 'upvote' | 'downvote' | null (populated; UI in PR7)
}

export interface CreateCommentRequest {
  entityType: CommentEntityType;
  entityId: number;
  parentCommentId?: number | null;
  content: string;
}
