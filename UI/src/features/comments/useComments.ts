import { useCallback, useEffect, useState } from 'react';
import { addCommentCall, deleteCommentCall, editCommentCall, getCommentCountCall, getCommentsCall, voteCommentCall } from '../../api/soroban-security-portal/soroban-security-portal-api';
import { Comment, CommentEntityType, CreateCommentRequest, VoteType } from '../../api/soroban-security-portal/models/comment';

export interface UseCommentsResult {
  comments: Comment[];
  count: number;
  loading: boolean;
  error: string | null;
  hasMore: boolean;
  loadMore: () => Promise<void>;
  post: (content: string, parentCommentId?: number | null) => Promise<boolean>;
  refresh: () => Promise<void>;
  vote: (id: number, voteType: VoteType) => Promise<void>;
  edit: (id: number, content: string) => Promise<boolean>;
  remove: (id: number) => Promise<boolean>;
}

const PAGE_SIZE = 20;

const mapTree = (list: Comment[], id: number, fn: (c: Comment) => Comment): Comment[] =>
  list.map((c) => (c.id === id ? fn(c) : { ...c, replies: mapTree(c.replies, id, fn) }));

const removeFromTree = (list: Comment[], id: number): Comment[] =>
  list.filter((c) => c.id !== id).map((c) => ({ ...c, replies: removeFromTree(c.replies, id) }));

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
        pageToLoad === 1 ? getCommentCountCall(entityType, entityId) : Promise.resolve(0),
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
  }, [entityType, entityId]);

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

  const vote = useCallback(async (id: number, voteType: VoteType) => {
    try {
      const r = await voteCommentCall(id, voteType);
      setComments((prev) => mapTree(prev, id, (c) => ({ ...c, upvoteCount: r.upvoteCount, downvoteCount: r.downvoteCount, currentUserVote: r.currentUserVote })));
    } catch { /* rest-api already surfaces the error toast */ }
  }, []);

  const edit = useCallback(async (id: number, content: string): Promise<boolean> => {
    if (!content.trim()) return false;
    try {
      const updated = await editCommentCall(id, content);
      setComments((prev) => mapTree(prev, id, (c) => ({ ...c, content: updated.content, contentHtml: updated.contentHtml, isEdited: true, updatedAt: updated.updatedAt })));
      return true;
    } catch { return false; }
  }, []);

  const remove = useCallback(async (id: number): Promise<boolean> => {
    try {
      await deleteCommentCall(id);
      setComments((prev) => removeFromTree(prev, id));
      setCount((c) => Math.max(0, c - 1));
      return true;
    } catch { return false; }
  }, []);

  return { comments, count, loading, error, hasMore, loadMore, post, refresh, vote, edit, remove };
};
