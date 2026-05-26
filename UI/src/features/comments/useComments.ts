import { useCallback, useEffect, useState } from 'react';
import { addCommentCall, getCommentCountCall, getCommentsCall } from '../../api/soroban-security-portal/soroban-security-portal-api';
import { Comment, CommentEntityType, CreateCommentRequest } from '../../api/soroban-security-portal/models/comment';

export interface UseCommentsResult {
  comments: Comment[];
  count: number;
  loading: boolean;
  error: string | null;
  hasMore: boolean;
  loadMore: () => Promise<void>;
  post: (content: string, parentCommentId?: number | null) => Promise<boolean>;
  refresh: () => Promise<void>;
}

const PAGE_SIZE = 20;

export const useComments = (entityType: CommentEntityType, entityId: number): UseCommentsResult => {
  const [comments, setComments] = useState<Comment[]>([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (pageToLoad: number, append: boolean) => {
    setLoading(true);
    setError(null);
    try {
      const [pageData, total] = await Promise.all([
        getCommentsCall(entityType, entityId, pageToLoad),
        pageToLoad === 1 ? getCommentCountCall(entityType, entityId) : Promise.resolve(count),
      ]);
      setComments((prev) => (append ? [...prev, ...pageData] : pageData));
      if (pageToLoad === 1) setCount(total);
      setHasMore(pageData.length === PAGE_SIZE);
      setPage(pageToLoad);
    } catch {
      setError('Failed to load comments');
    } finally {
      setLoading(false);
    }
  }, [entityType, entityId, count]);

  useEffect(() => {
    if (entityId > 0) void load(1, false);
  }, [entityType, entityId]);

  const loadMore = useCallback(async () => { await load(page + 1, true); }, [load, page]);
  const refresh = useCallback(async () => { await load(1, false); }, [load]);

  const post = useCallback(async (content: string, parentCommentId?: number | null): Promise<boolean> => {
    if (!content.trim()) return false;
    const request: CreateCommentRequest = { entityType, entityId, parentCommentId: parentCommentId ?? null, content };
    try {
      await addCommentCall(request);
      await load(1, false); // simplest correct refresh; reply nesting recomputed server-side
      return true;
    } catch {
      return false;
    }
  }, [entityType, entityId, load]);

  return { comments, count, loading, error, hasMore, loadMore, post, refresh };
};
