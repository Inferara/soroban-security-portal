import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import {
  getForumThreads,
  getForumCategoryBySlug,
} from '../../../../../api/soroban-security-portal/soroban-security-portal-api';
import {
  ForumCategory,
  ForumThread,
  ThreadSortOption,
  PaginatedThreadsResponse,
} from '../../../../../api/soroban-security-portal/models/forum';

const DEFAULT_PAGE_SIZE = 20;

export const useCategoryThreads = () => {
  const { slug } = useParams<{ slug: string }>();

  const [category, setCategory] = useState<ForumCategory | null>(null);
  const [threads, setThreads] = useState<ForumThread[]>([]);

  const [page, setPage] = useState(1);
  const [pageSize] = useState(DEFAULT_PAGE_SIZE);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const [sortBy, setSortBy] = useState<ThreadSortOption>('latest');

  const [loadingCategory, setLoadingCategory] = useState(true);
  const [loadingThreads, setLoadingThreads] = useState(true);

  const [categoryError, setCategoryError] = useState<string | null>(null);
  const [threadsError, setThreadsError] = useState<string | null>(null);

  const fetchCategory = useCallback(async () => {
    if (!slug) return;

    try {
      setLoadingCategory(true);
      setCategoryError(null);

      const data = await getForumCategoryBySlug(slug);
      setCategory(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load category';
      setCategoryError(message);
    } finally {
      setLoadingCategory(false);
    }
  }, [slug]);

  const fetchThreads = useCallback(async () => {
    if (!slug) return;

    try {
      setLoadingThreads(true);
      setThreadsError(null);

      const response: PaginatedThreadsResponse = await getForumThreads({
        categorySlug: slug,
        sortBy,
        page,
        pageSize,
      });

      setThreads(response.threads);
      setTotalPages(response.totalPages);
      setTotalCount(response.totalCount);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load threads';
      setThreadsError(message);
    } finally {
      setLoadingThreads(false);
    }
  }, [slug, sortBy, page, pageSize]);

  useEffect(() => {
    fetchCategory();
  }, [fetchCategory]);

  useEffect(() => {
    fetchThreads();
  }, [fetchThreads]);

  const handleSortChange = useCallback((newSortBy: ThreadSortOption) => {
    setSortBy(newSortBy);
    setPage(1);
  }, []);

  const handlePageChange = useCallback((newPage: number) => {
    setPage(newPage);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const loading = loadingCategory || loadingThreads;

  const error = categoryError || threadsError;

  return {
    slug,
    category,
    threads,
    sortBy,
    setSortBy: handleSortChange,
    page,
    setPage: handlePageChange,
    pageSize,
    totalPages,
    totalCount,
    loading,
    loadingCategory,
    loadingThreads,
    error,
    refreshThreads: fetchThreads,
    refreshCategory: fetchCategory,
  };
};

