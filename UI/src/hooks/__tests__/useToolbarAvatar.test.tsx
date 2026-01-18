import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { AuthContext, AuthContextProps } from 'react-oidc-context';
import { ReactNode } from 'react';
import { useToolbarAvatar } from '../useToolbarAvatar';
import * as api from '../../api/soroban-security-portal/soroban-security-portal-api';

// Mock the API module
vi.mock('../../api/soroban-security-portal/soroban-security-portal-api', () => ({
  getUserByIdCall: vi.fn(),
}));

// Mock environment
vi.mock('../../environments/environment', () => ({
  environment: {
    apiUrl: 'http://localhost:3000',
  },
}));

const mockedGetUserByIdCall = vi.mocked(api.getUserByIdCall);

describe('useToolbarAvatar', () => {
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

  const createWrapper = (auth: AuthContextProps) => {
    return ({ children }: { children: ReactNode }) => (
      <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>
    );
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('unauthenticated user', () => {
    it('returns null avatarUrl', async () => {
      const auth = createMockAuth({ isAuthenticated: false });
      const { result } = renderHook(() => useToolbarAvatar(), {
        wrapper: createWrapper(auth),
      });

      await waitFor(() => {
        expect(result.current.avatarUrl).toBeNull();
      });
    });

    it('returns false for avatarLoading after initialization', async () => {
      const auth = createMockAuth({ isAuthenticated: false });
      const { result } = renderHook(() => useToolbarAvatar(), {
        wrapper: createWrapper(auth),
      });

      await waitFor(() => {
        expect(result.current.avatarLoading).toBe(false);
      });
    });

    it('does not call API', async () => {
      const auth = createMockAuth({ isAuthenticated: false });
      renderHook(() => useToolbarAvatar(), {
        wrapper: createWrapper(auth),
      });

      await waitFor(() => {
        expect(mockedGetUserByIdCall).not.toHaveBeenCalled();
      });
    });
  });

  describe('authenticated user', () => {
    const authenticatedAuth = createMockAuth({
      isAuthenticated: true,
      user: {
        access_token: 'test-token',
        token_type: 'Bearer',
        profile: {
          sub: '123',
          name: 'Test User',
        },
        expires_at: Date.now() / 1000 + 3600,
        expired: false,
        scopes: ['openid'],
      } as any,
    });

    it('calls API with loginId 0 to get current user', async () => {
      mockedGetUserByIdCall.mockResolvedValue({
        loginId: 42,
        userName: 'testuser',
        email: 'test@example.com',
        role: 1,
        createdBy: 'system',
        isAvatarManuallySet: false,
      });

      renderHook(() => useToolbarAvatar(), {
        wrapper: createWrapper(authenticatedAuth),
      });

      await waitFor(() => {
        expect(mockedGetUserByIdCall).toHaveBeenCalledWith(0);
      });
    });

    it('constructs avatar URL with user loginId', async () => {
      mockedGetUserByIdCall.mockResolvedValue({
        loginId: 42,
        userName: 'testuser',
        email: 'test@example.com',
        role: 1,
        createdBy: 'system',
        isAvatarManuallySet: false,
      });

      const { result } = renderHook(() => useToolbarAvatar(), {
        wrapper: createWrapper(authenticatedAuth),
      });

      await waitFor(() => {
        expect(result.current.avatarUrl).toContain('http://localhost:3000/api/v1/user/42/avatar.png');
      });
    });

    it('includes cache buster in URL', async () => {
      mockedGetUserByIdCall.mockResolvedValue({
        loginId: 42,
        userName: 'testuser',
        email: 'test@example.com',
        role: 1,
        createdBy: 'system',
        isAvatarManuallySet: false,
      });

      const { result } = renderHook(() => useToolbarAvatar(), {
        wrapper: createWrapper(authenticatedAuth),
      });

      await waitFor(() => {
        expect(result.current.avatarUrl).toMatch(/\?t=\d+/);
      });
    });

    it('returns avatarLoading true while initializing', () => {
      mockedGetUserByIdCall.mockImplementation(
        () => new Promise(() => {}) // Never resolves
      );

      const { result } = renderHook(() => useToolbarAvatar(), {
        wrapper: createWrapper(authenticatedAuth),
      });

      expect(result.current.avatarLoading).toBe(true);
    });

    it('handles API error gracefully', async () => {
      mockedGetUserByIdCall.mockRejectedValue(new Error('API Error'));

      const { result } = renderHook(() => useToolbarAvatar(), {
        wrapper: createWrapper(authenticatedAuth),
      });

      await waitFor(() => {
        expect(result.current.avatarUrl).toBeNull();
        expect(result.current.avatarLoading).toBe(false);
      });
    });
  });

  describe('avatar event handlers', () => {
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

    beforeEach(() => {
      mockedGetUserByIdCall.mockResolvedValue({
        loginId: 42,
        userName: 'testuser',
        email: 'test@example.com',
        role: 1,
        createdBy: 'system',
        isAvatarManuallySet: false,
      });
    });

    it('handleAvatarLoad sets loading to false', async () => {
      const { result } = renderHook(() => useToolbarAvatar(), {
        wrapper: createWrapper(authenticatedAuth),
      });

      await waitFor(() => {
        expect(result.current.avatarUrl).not.toBeNull();
      });

      act(() => {
        result.current.handleAvatarLoad();
      });

      expect(result.current.avatarLoading).toBe(false);
    });

    it('handleAvatarError sets error to true', async () => {
      const { result } = renderHook(() => useToolbarAvatar(), {
        wrapper: createWrapper(authenticatedAuth),
      });

      await waitFor(() => {
        expect(result.current.avatarUrl).not.toBeNull();
      });

      act(() => {
        result.current.handleAvatarError();
      });

      expect(result.current.avatarError).toBe(true);
    });

    it('handleAvatarError sets loading to false', async () => {
      const { result } = renderHook(() => useToolbarAvatar(), {
        wrapper: createWrapper(authenticatedAuth),
      });

      await waitFor(() => {
        expect(result.current.avatarUrl).not.toBeNull();
      });

      act(() => {
        result.current.handleAvatarError();
      });

      expect(result.current.avatarLoading).toBe(false);
    });
  });

  describe('return type', () => {
    it('returns all required properties', async () => {
      const auth = createMockAuth({ isAuthenticated: false });
      const { result } = renderHook(() => useToolbarAvatar(), {
        wrapper: createWrapper(auth),
      });

      await waitFor(() => {
        expect(result.current).toHaveProperty('avatarUrl');
        expect(result.current).toHaveProperty('avatarLoading');
        expect(result.current).toHaveProperty('avatarError');
        expect(result.current).toHaveProperty('handleAvatarLoad');
        expect(result.current).toHaveProperty('handleAvatarError');
      });
    });

    it('handleAvatarLoad is a stable function reference', async () => {
      const auth = createMockAuth({ isAuthenticated: false });
      const { result, rerender } = renderHook(() => useToolbarAvatar(), {
        wrapper: createWrapper(auth),
      });

      const firstRef = result.current.handleAvatarLoad;
      rerender();
      const secondRef = result.current.handleAvatarLoad;

      expect(firstRef).toBe(secondRef);
    });

    it('handleAvatarError is a stable function reference', async () => {
      const auth = createMockAuth({ isAuthenticated: false });
      const { result, rerender } = renderHook(() => useToolbarAvatar(), {
        wrapper: createWrapper(auth),
      });

      const firstRef = result.current.handleAvatarError;
      rerender();
      const secondRef = result.current.handleAvatarError;

      expect(firstRef).toBe(secondRef);
    });
  });
});
