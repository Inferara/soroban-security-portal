import { useEffect, useState } from 'react';
import { searchUsersCall } from '../../api/soroban-security-portal/soroban-security-portal-api';
import { UserSearchResult } from '../../api/soroban-security-portal/models/comment';

const DEBOUNCE_MS = 300;

export const useUserSearch = (query: string, minLength = 1): UserSearchResult[] => {
  const [results, setResults] = useState<UserSearchResult[]>([]);
  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < minLength) {
      setResults([]);
      return;
    }
    const handle = setTimeout(() => {
      searchUsersCall(trimmed).then(setResults).catch(() => setResults([]));
    }, DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [query, minLength]);
  return results;
};
