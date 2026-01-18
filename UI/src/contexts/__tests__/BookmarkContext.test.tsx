import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { AuthContext, AuthContextProps } from 'react-oidc-context';
import { ReactNode } from 'react';
import { BookmarkProvider, useBookmarks } from '../BookmarkContext';
import * as api from '../../api/soroban-security-portal/soroban-security-portal-api';
import { Bookmark, BookmarkType } from '../../api/soroban-security-portal/models/bookmark';

// Mock the API module
vi.mock('../../api/soroban-security-portal/soroban-security-portal-api', () => ({
  getBookmarksCall: vi.fn(),
  addBookmarkCall: vi.fn(),
  removeBookmarkCall: vi.fn(),
}));

const mockedGetBookmarks = vi.mocked(api.getBookmarksCall);
const mockedAddBookmark = vi.mocked(api.addBookmarkCall);
const mockedRemoveBookmark = vi.mocked(api.removeBookmarkCall);

describe('BookmarkContext', () => {
  const createMockAuth = (overrides: Partial<AuthContextProps> = {}): AuthContextProps => ({
    isAuthenticated: false,
    isLoading: false,
    user: null,
    activeNavigator: undefined,
    signinRedirect: vi.fn(),
    signinSilent: vi.fn(),
    signinPopup: vi.fn(),
    signoutRedirect: vi.fn(),
    signoutPopup: vi.fn(),
    signoutSilent: vi.fn(),
    removeUser: vi.fn(),
    revokeTokens: vi.fn(),
    clearStaleState: vi.fn(),
    querySessionStatus: vi.fn(),
    startSilentRenew: vi.fn(),
    stopSilentRenew: vi.fn(),
    settings: {} as any,
    events: {} as any,
    ...overrides,
  });

  const mockBookmarks: Bookmark[] = [
    { id: 1, loginId: 1, itemId: 100, bookmarkType: BookmarkType.Vulnerability },
    { id: 2, loginId: 1, itemId: 200, bookmarkType: BookmarkType.Report },
  ];

  const createWrapper = (auth: AuthContextProps) => {
    return ({ children }: { children: ReactNode }) => (
      <AuthContext.Provider value={auth}>
        <BookmarkProvider>{children}</BookmarkProvider>
      </AuthContext.Provider>
    );
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('useBookmarks hook', () => {
    it('throws error when used outside BookmarkProvider', () => {
      expect(() => {
        renderHook(() => useBookmarks());
      }).toThrow('useBookmarks must be used within a BookmarkProvider');
    });
  });

  describe('unauthenticated user', () => {
    it('returns empty bookmarks array', async () => {
      const auth = createMockAuth({ isAuthenticated: false });
      const { result } = renderHook(() => useBookmarks(), {
        wrapper: createWrapper(auth),
      });

      await waitFor(() => {
        expect(result.current.bookmarks).toEqual([]);
      });
    });

    it('does not call API', async () => {
      const auth = createMockAuth({ isAuthenticated: false });
      renderHook(() => useBookmarks(), {
        wrapper: createWrapper(auth),
      });

      await waitFor(() => {
        expect(mockedGetBookmarks).not.toHaveBeenCalled();
      });
    });

    it('returns false for loading after initialization', async () => {
      const auth = createMockAuth({ isAuthenticated: false });
      const { result } = renderHook(() => useBookmarks(), {
        wrapper: createWrapper(auth),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
    });
  });

  describe('authenticated user', () => {
    const authenticatedAuth = createMockAuth({
      isAuthenticated: true,
      user: {
        access_token: 'test-token',
        token_type: 'Bearer',
        profile: { sub: '123', name: 'Test User' },
        expires_at: Date.now() / 1000 + 3600,
        expired: false,
        scopes: ['openid'],
      } as any,
    });

    it('fetches bookmarks on mount', async () => {
      mockedGetBookmarks.mockResolvedValue(mockBookmarks);

      const { result } = renderHook(() => useBookmarks(), {
        wrapper: createWrapper(authenticatedAuth),
      });

      await waitFor(() => {
        expect(mockedGetBookmarks).toHaveBeenCalledTimes(1);
        expect(result.current.bookmarks).toEqual(mockBookmarks);
      });
    });

    it('sets loading state while fetching', async () => {
      mockedGetBookmarks.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve(mockBookmarks), 100))
      );

      const { result } = renderHook(() => useBookmarks(), {
        wrapper: createWrapper(authenticatedAuth),
      });

      expect(result.current.loading).toBe(true);

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
    });

    it('handles fetch error', async () => {
      mockedGetBookmarks.mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() => useBookmarks(), {
        wrapper: createWrapper(authenticatedAuth),
      });

      await waitFor(() => {
        expect(result.current.error).toBe('Network error');
      });
    });
  });

  describe('isBookmarked', () => {
    it('returns true for bookmarked item', async () => {
      const auth = createMockAuth({
        isAuthenticated: true,
        user: {
          access_token: 'test',
          token_type: 'Bearer',
          profile: { sub: '1' },
          expires_at: Date.now() / 1000 + 3600,
          expired: false,
          scopes: [],
        } as any,
      });
      mockedGetBookmarks.mockResolvedValue(mockBookmarks);

      const { result } = renderHook(() => useBookmarks(), {
        wrapper: createWrapper(auth),
      });

      await waitFor(() => {
        expect(result.current.isBookmarked(100, BookmarkType.Vulnerability)).toBe(true);
      });
    });

    it('returns false for non-bookmarked item', async () => {
      const auth = createMockAuth({
        isAuthenticated: true,
        user: {
          access_token: 'test',
          token_type: 'Bearer',
          profile: { sub: '1' },
          expires_at: Date.now() / 1000 + 3600,
          expired: false,
          scopes: [],
        } as any,
      });
      mockedGetBookmarks.mockResolvedValue(mockBookmarks);

      const { result } = renderHook(() => useBookmarks(), {
        wrapper: createWrapper(auth),
      });

      await waitFor(() => {
        expect(result.current.isBookmarked(999, BookmarkType.Vulnerability)).toBe(false);
      });
    });

    it('returns false for wrong bookmark type', async () => {
      const auth = createMockAuth({
        isAuthenticated: true,
        user: {
          access_token: 'test',
          token_type: 'Bearer',
          profile: { sub: '1' },
          expires_at: Date.now() / 1000 + 3600,
          expired: false,
          scopes: [],
        } as any,
      });
      mockedGetBookmarks.mockResolvedValue(mockBookmarks);

      const { result } = renderHook(() => useBookmarks(), {
        wrapper: createWrapper(auth),
      });

      await waitFor(() => {
        // Item 100 is bookmarked as Vulnerability, not Report
        expect(result.current.isBookmarked(100, BookmarkType.Report)).toBe(false);
      });
    });
  });

  describe('getBookmarkId', () => {
    it('returns bookmark ID for existing bookmark', async () => {
      const auth = createMockAuth({
        isAuthenticated: true,
        user: {
          access_token: 'test',
          token_type: 'Bearer',
          profile: { sub: '1' },
          expires_at: Date.now() / 1000 + 3600,
          expired: false,
          scopes: [],
        } as any,
      });
      mockedGetBookmarks.mockResolvedValue(mockBookmarks);

      const { result } = renderHook(() => useBookmarks(), {
        wrapper: createWrapper(auth),
      });

      await waitFor(() => {
        expect(result.current.getBookmarkId(100, BookmarkType.Vulnerability)).toBe(1);
      });
    });

    it('returns null for non-existing bookmark', async () => {
      const auth = createMockAuth({
        isAuthenticated: true,
        user: {
          access_token: 'test',
          token_type: 'Bearer',
          profile: { sub: '1' },
          expires_at: Date.now() / 1000 + 3600,
          expired: false,
          scopes: [],
        } as any,
      });
      mockedGetBookmarks.mockResolvedValue(mockBookmarks);

      const { result } = renderHook(() => useBookmarks(), {
        wrapper: createWrapper(auth),
      });

      await waitFor(() => {
        expect(result.current.getBookmarkId(999, BookmarkType.Vulnerability)).toBeNull();
      });
    });
  });

  describe('addBookmark', () => {
    const authenticatedAuth = createMockAuth({
      isAuthenticated: true,
      user: {
        access_token: 'test',
        token_type: 'Bearer',
        profile: { sub: '1' },
        expires_at: Date.now() / 1000 + 3600,
        expired: false,
        scopes: [],
      } as any,
    });

    it('adds bookmark and refreshes list', async () => {
      const newBookmark: Bookmark = { id: 3, loginId: 1, itemId: 300, bookmarkType: BookmarkType.Report };
      mockedGetBookmarks
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([newBookmark]);
      mockedAddBookmark.mockResolvedValue(newBookmark);

      const { result } = renderHook(() => useBookmarks(), {
        wrapper: createWrapper(authenticatedAuth),
      });

      await waitFor(() => {
        expect(result.current.bookmarks).toEqual([]);
      });

      let added: Bookmark | null = null;
      await act(async () => {
        added = await result.current.addBookmark(300, BookmarkType.Report);
      });

      expect(added).toEqual(newBookmark);
      expect(mockedAddBookmark).toHaveBeenCalledWith(
        expect.objectContaining({ itemId: 300, bookmarkType: BookmarkType.Report })
      );
    });

    it('returns null when not authenticated', async () => {
      const unauthAuth = createMockAuth({ isAuthenticated: false });
      mockedGetBookmarks.mockResolvedValue([]);

      const { result } = renderHook(() => useBookmarks(), {
        wrapper: createWrapper(unauthAuth),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      let added: Bookmark | null = null;
      await act(async () => {
        added = await result.current.addBookmark(300, BookmarkType.Report);
      });

      expect(added).toBeNull();
      expect(mockedAddBookmark).not.toHaveBeenCalled();
    });
  });

  describe('removeBookmark', () => {
    const authenticatedAuth = createMockAuth({
      isAuthenticated: true,
      user: {
        access_token: 'test',
        token_type: 'Bearer',
        profile: { sub: '1' },
        expires_at: Date.now() / 1000 + 3600,
        expired: false,
        scopes: [],
      } as any,
    });

    it('removes bookmark and refreshes list', async () => {
      mockedGetBookmarks
        .mockResolvedValueOnce(mockBookmarks)
        .mockResolvedValueOnce([mockBookmarks[1]]);
      mockedRemoveBookmark.mockResolvedValue(undefined);

      const { result } = renderHook(() => useBookmarks(), {
        wrapper: createWrapper(authenticatedAuth),
      });

      await waitFor(() => {
        expect(result.current.bookmarks).toHaveLength(2);
      });

      let success = false;
      await act(async () => {
        success = await result.current.removeBookmark(1);
      });

      expect(success).toBe(true);
      expect(mockedRemoveBookmark).toHaveBeenCalledWith(1);
    });

    it('returns false when not authenticated', async () => {
      const unauthAuth = createMockAuth({ isAuthenticated: false });
      mockedGetBookmarks.mockResolvedValue([]);

      const { result } = renderHook(() => useBookmarks(), {
        wrapper: createWrapper(unauthAuth),
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      let success = true;
      await act(async () => {
        success = await result.current.removeBookmark(1);
      });

      expect(success).toBe(false);
      expect(mockedRemoveBookmark).not.toHaveBeenCalled();
    });
  });

  describe('toggleBookmark', () => {
    const authenticatedAuth = createMockAuth({
      isAuthenticated: true,
      user: {
        access_token: 'test',
        token_type: 'Bearer',
        profile: { sub: '1' },
        expires_at: Date.now() / 1000 + 3600,
        expired: false,
        scopes: [],
      } as any,
    });

    it('adds bookmark when not bookmarked', async () => {
      const newBookmark: Bookmark = { id: 3, loginId: 1, itemId: 300, bookmarkType: BookmarkType.Report };
      mockedGetBookmarks
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([newBookmark]);
      mockedAddBookmark.mockResolvedValue(newBookmark);

      const { result } = renderHook(() => useBookmarks(), {
        wrapper: createWrapper(authenticatedAuth),
      });

      await waitFor(() => {
        expect(result.current.bookmarks).toEqual([]);
      });

      let success = false;
      await act(async () => {
        success = await result.current.toggleBookmark(300, BookmarkType.Report);
      });

      expect(success).toBe(true);
      expect(mockedAddBookmark).toHaveBeenCalled();
    });

    it('removes bookmark when already bookmarked', async () => {
      mockedGetBookmarks
        .mockResolvedValueOnce(mockBookmarks)
        .mockResolvedValueOnce([mockBookmarks[1]]);
      mockedRemoveBookmark.mockResolvedValue(undefined);

      const { result } = renderHook(() => useBookmarks(), {
        wrapper: createWrapper(authenticatedAuth),
      });

      await waitFor(() => {
        expect(result.current.bookmarks).toHaveLength(2);
      });

      let success = false;
      await act(async () => {
        success = await result.current.toggleBookmark(100, BookmarkType.Vulnerability);
      });

      expect(success).toBe(true);
      expect(mockedRemoveBookmark).toHaveBeenCalledWith(1);
    });
  });

  describe('refreshBookmarks', () => {
    it('refetches bookmarks from API', async () => {
      const auth = createMockAuth({
        isAuthenticated: true,
        user: {
          access_token: 'test',
          token_type: 'Bearer',
          profile: { sub: '1' },
          expires_at: Date.now() / 1000 + 3600,
          expired: false,
          scopes: [],
        } as any,
      });
      mockedGetBookmarks
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce(mockBookmarks);

      const { result } = renderHook(() => useBookmarks(), {
        wrapper: createWrapper(auth),
      });

      await waitFor(() => {
        expect(result.current.bookmarks).toEqual([]);
      });

      await act(async () => {
        await result.current.refreshBookmarks();
      });

      expect(mockedGetBookmarks).toHaveBeenCalledTimes(2);
      expect(result.current.bookmarks).toEqual(mockBookmarks);
    });
  });
});
