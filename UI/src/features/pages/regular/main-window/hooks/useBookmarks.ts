import { useState, useEffect, useCallback } from 'react';
import { useAuth } from 'react-oidc-context';
import { Bookmark, BookmarkType, CreateBookmark } from '../../../../../api/soroban-security-portal/models/bookmark';
import { getBookmarksCall, addBookmarkCall, removeBookmarkCall } from '../../../../../api/soroban-security-portal/soroban-security-portal-api';

export const useBookmarks = () => {
    const auth = useAuth();
    const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchBookmarks = useCallback(async () => {
        // Don't fetch if auth is still loading
        if (auth.isLoading) {
            return;
        }
        
        // Clear bookmarks if not authenticated
        if (!auth.isAuthenticated || !auth.user) {
            setBookmarks([]);
            return;
        }
        
        setLoading(true);
        setError(null);
        try {
            const data = await getBookmarksCall();
            setBookmarks(data);
        } catch (err) {
            setError('Failed to load bookmarks');
            console.error('Error fetching bookmarks:', err);
        } finally {
            setLoading(false);
        }
    }, [auth.isAuthenticated, auth.isLoading]);

    useEffect(() => {
        fetchBookmarks();
    }, [fetchBookmarks]);

    const addBookmark = async (itemId: number, bookmarkType: BookmarkType): Promise<Bookmark | null> => {
        if (!auth.user?.profile || !auth.isAuthenticated) {
            console.warn('User not authenticated, cannot add bookmark');
            return null;
        }

        try {
            const newBookmark: CreateBookmark = {
                id: 0,
                loginId: 0, // Backend sets this from auth context
                itemId,
                bookmarkType
            };
            const added = await addBookmarkCall(newBookmark);
            // Refresh the bookmark list from server to get updated state
            await fetchBookmarks();
            return added;
        } catch (err) {
            console.error('Error adding bookmark:', err);
            setError('Failed to add bookmark');
            return null;
        }
    };

    const removeBookmark = async (bookmarkId: number): Promise<boolean> => {
        if (!auth.isAuthenticated) {
            console.warn('User not authenticated, cannot remove bookmark');
            return false;
        }
        
        try {
            await removeBookmarkCall(bookmarkId);
            // Refresh the bookmark list from server to get updated state
            await fetchBookmarks();
            return true;
        } catch (err) {
            console.error('Error removing bookmark:', err);
            setError('Failed to remove bookmark');
            return false;
        }
    };

    const isBookmarked = (itemId: number, bookmarkType: BookmarkType): boolean => {
        return bookmarks.some(b => b.itemId === itemId && b.bookmarkType === bookmarkType);
    };

    const getBookmarkId = (itemId: number, bookmarkType: BookmarkType): number | null => {
        const bookmark = bookmarks.find(b => b.itemId === itemId && b.bookmarkType === bookmarkType);
        return bookmark?.id ?? null;
    };

    const toggleBookmark = async (itemId: number, bookmarkType: BookmarkType): Promise<boolean> => {
        const bookmarkId = getBookmarkId(itemId, bookmarkType);
        if (bookmarkId) {
            return await removeBookmark(bookmarkId);
        } else {
            const added = await addBookmark(itemId, bookmarkType);
            return added !== null;
        }
    };

    return {
        bookmarks,
        loading,
        error,
        addBookmark,
        removeBookmark,
        isBookmarked,
        getBookmarkId,
        toggleBookmark,
        refreshBookmarks: fetchBookmarks
    };
};
