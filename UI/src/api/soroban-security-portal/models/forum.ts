export interface ForumCategory {
  id: number;
  slug: string;
  name: string;
  description: string;
  threadCount: number;
  lastActivityAt: string | null;
  lastThreadTitle?: string;
  lastActivityBy?: string;
  displayOrder: number;
  icon?: string;
  color?: string;
}

export interface ForumThread {
  id: number;
  slug: string;
  title: string;
  categoryId: number;
  categorySlug: string;
  authorId: number;
  authorName: string;
  authorAvatarUrl?: string;
  createdAt: string;
  lastActivityAt: string;
  lastReplyBy?: string;
  replyCount: number;
  viewCount: number;
  isPinned: boolean;
  isLocked: boolean;
  excerpt?: string;
  tags?: string[];
}

export interface ForumThreadDetail extends ForumThread {
  content: string;
  replies?: ForumReply[];
}

export interface ForumReply {
  id: number;
  threadId: number;
  authorId: number;
  authorName: string;
  authorAvatarUrl?: string;
  content: string;
  createdAt: string;
  updatedAt?: string;
  parentReplyId?: number;
}

export type ThreadSortOption = 'latest' | 'most-active' | 'newest';

export interface ThreadSearchParams {
  categorySlug?: string;
  searchText?: string;
  sortBy?: ThreadSortOption;
  page?: number;
  pageSize?: number;
  tag?: string;
}

export interface PaginatedThreadsResponse {
  threads: ForumThread[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface CreateThreadParams {
  title: string;
  content: string;
  categoryId: number;
  tags?: string[];
}

