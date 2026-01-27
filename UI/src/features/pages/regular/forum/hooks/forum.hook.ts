import { useEffect, useState, useCallback } from 'react';
import { getForumCategories } from '../../../../../api/soroban-security-portal/soroban-security-portal-api';
import { ForumCategory } from '../../../../../api/soroban-security-portal/models/forum';

export const useForum = () => {
  const [categories, setCategories] = useState<ForumCategory[]>([]);

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState<string | null>(null);

  const fetchCategories = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const data = await getForumCategories();

      // Sort by displayOrder (backend should do this, but need to make sure on the client-side too)
      const sorted = [...data].sort((a, b) => a.displayOrder - b.displayOrder);
      setCategories(sorted);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load forum categories';
      setError(message);
      console.error('Error fetching forum categories:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch categories on component mount
  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  return {
    categories,
    loading,
    error,
    refresh: fetchCategories,
  };
};

