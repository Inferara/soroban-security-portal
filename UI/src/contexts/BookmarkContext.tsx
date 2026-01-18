import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useAuth } from 'react-oidc-context';
import { Bookmark, BookmarkType, CreateBookmark } from '../api/soroban-security-portal/models/bookmark';
import { getBookmarksCall, addBookmarkCall, removeBookmarkCall } from '../api/soroban-security-portal/soroban-security-portal-api';

interface BookmarkContextType {
    bookmarks: Bookmark[];
    loading: boolean;
    error: string | null;
    addBookmark: (itemId: number, bookmarkType: BookmarkType) => Promise<Bookmark | null>;
    removeBookmark: (bookmarkId: number) => Promise<boolean>;
    isBookmarked: (itemId: number, bookmarkType: BookmarkType) => boolean;
    getBookmarkId: (itemId: number, bookmarkType: BookmarkType) => number | null;
    toggleBookmark: (itemId: number, bookmarkType: BookmarkType) => Promise<boolean>;
    refreshBookmarks: () => Promise<void>;
}

const BookmarkContext = createContext<BookmarkContextType | undefined>(undefined);

export const useBookmarks = () => {
    const context = useContext(BookmarkContext);
    if (!context) {
        throw new Error('useBookmarks must be used within a BookmarkProvider');
    }
    return context;
};

interface BookmarkProviderProps {
    children: ReactNode;
}

export const BookmarkProvider = ({ children }: BookmarkProviderProps) => {
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
        } catch (err: unknown) {
            console.error('Error fetching bookmarks:', err);
            const errorMessage = err instanceof Error ? err.message : 'Failed to load bookmarks';
            
            // Don't show error for authentication issues, just silently clear bookmarks
            if (errorMessage.includes('Authentication') || errorMessage.includes('log in')) {
                setBookmarks([]);
                console.warn('Authentication required for bookmarks - user needs to log in');
            } else {
                setError(errorMessage);
            }
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
        } catch (err: unknown) {
            console.error('Error adding bookmark:', err);
            const errorMessage = err instanceof Error ? err.message : 'Failed to add bookmark';
            
            // Don't show error for authentication issues
            if (errorMessage.includes('Authentication') || errorMessage.includes('log in')) {
                console.warn('Authentication required for adding bookmarks');
            } else {
                setError(errorMessage);
            }
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
        } catch (err: unknown) {
            console.error('Error removing bookmark:', err);
            const errorMessage = err instanceof Error ? err.message : 'Failed to remove bookmark';
            
            // Don't show error for authentication issues
            if (errorMessage.includes('Authentication') || errorMessage.includes('log in')) {
                console.warn('Authentication required for removing bookmarks');
            } else {
                setError(errorMessage);
            }
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

    const value: BookmarkContextType = {
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

    return (
        <BookmarkContext.Provider value={value}>
            {children}
        </BookmarkContext.Provider>
    );
};