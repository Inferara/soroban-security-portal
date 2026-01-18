import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTokenLifecycle } from '../useTokenLifecycle';

// Mock navigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

// Mock environment
vi.mock('../../environments/environment', () => ({
  environment: {
    apiUrl: 'http://localhost:3000',
    clientId: 'test-client-id',
    basePath: '/app',
  },
}));

// Mock auth events
const mockEventListeners = {
  accessTokenExpiring: new Set<() => void>(),
  accessTokenExpired: new Set<() => void>(),
  silentRenewError: new Set<(error: Error) => void>(),
};

const mockSigninSilent = vi.fn();
const mockRemoveUser = vi.fn();

const createMockAuth = (overrides = {}) => ({
  user: {
    expires_at: Math.floor(Date.now() / 1000) + 300, // 5 minutes from now
  },
  isAuthenticated: true,
  isLoading: false,
  signinSilent: mockSigninSilent,
  removeUser: mockRemoveUser,
  events: {
    addAccessTokenExpiring: vi.fn((cb) => {
      mockEventListeners.accessTokenExpiring.add(cb);
      return () => mockEventListeners.accessTokenExpiring.delete(cb);
    }),
    addAccessTokenExpired: vi.fn((cb) => {
      mockEventListeners.accessTokenExpired.add(cb);
      return () => mockEventListeners.accessTokenExpired.delete(cb);
    }),
    addSilentRenewError: vi.fn((cb) => {
      mockEventListeners.silentRenewError.add(cb);
      return () => mockEventListeners.silentRenewError.delete(cb);
    }),
  },
  ...overrides,
});

let mockAuth = createMockAuth();

vi.mock('react-oidc-context', () => ({
  useAuth: () => mockAuth,
}));

// Helper to trigger events
const triggerAccessTokenExpiring = () => {
  mockEventListeners.accessTokenExpiring.forEach((cb) => cb());
};

const triggerAccessTokenExpired = () => {
  mockEventListeners.accessTokenExpired.forEach((cb) => cb());
};

const triggerSilentRenewError = (error: Error) => {
  mockEventListeners.silentRenewError.forEach((cb) => cb(error));
};

describe('useTokenLifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEventListeners.accessTokenExpiring.clear();
    mockEventListeners.accessTokenExpired.clear();
    mockEventListeners.silentRenewError.clear();

    // Reset auth mock to valid state
    mockAuth = createMockAuth();

    // Clear localStorage
    localStorage.clear();
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  describe('initialization', () => {
    it('initializes with session not expiring', () => {
      const { result } = renderHook(() => useTokenLifecycle());

      expect(result.current.isSessionExpiring).toBe(false);
      expect(result.current.secondsUntilExpiry).toBeNull();
    });

    it('subscribes to auth events on mount', () => {
      renderHook(() => useTokenLifecycle());

      expect(mockAuth.events.addAccessTokenExpiring).toHaveBeenCalled();
      expect(mockAuth.events.addAccessTokenExpired).toHaveBeenCalled();
      expect(mockAuth.events.addSilentRenewError).toHaveBeenCalled();
    });

    it('provides extendSession function', () => {
      const { result } = renderHook(() => useTokenLifecycle());

      expect(typeof result.current.extendSession).toBe('function');
    });

    it('provides endSession function', () => {
      const { result } = renderHook(() => useTokenLifecycle());

      expect(typeof result.current.endSession).toBe('function');
    });
  });

  describe('access token expiring event', () => {
    it('sets isSessionExpiring to true when token is expiring', () => {
      const { result } = renderHook(() => useTokenLifecycle());

      act(() => {
        triggerAccessTokenExpiring();
      });

      expect(result.current.isSessionExpiring).toBe(true);
    });

    it('calls onSessionExpiring callback', () => {
      const onSessionExpiring = vi.fn();
      renderHook(() => useTokenLifecycle({ onSessionExpiring }));

      act(() => {
        triggerAccessTokenExpiring();
      });

      expect(onSessionExpiring).toHaveBeenCalled();
    });

    it('attempts silent renewal on token expiring', () => {
      mockSigninSilent.mockResolvedValue({});

      renderHook(() => useTokenLifecycle());

      act(() => {
        triggerAccessTokenExpiring();
      });

      expect(mockSigninSilent).toHaveBeenCalled();
    });
  });

  describe('access token expired event', () => {
    it('calls onSessionExpired callback', async () => {
      const onSessionExpired = vi.fn();
      renderHook(() => useTokenLifecycle({ onSessionExpired }));

      await act(async () => {
        triggerAccessTokenExpired();
      });

      expect(onSessionExpired).toHaveBeenCalled();
    });

    it('calls removeUser on token expired', async () => {
      renderHook(() => useTokenLifecycle());

      await act(async () => {
        triggerAccessTokenExpired();
      });

      expect(mockRemoveUser).toHaveBeenCalled();
    });

    it('resets isSessionExpiring on token expired', async () => {
      const { result } = renderHook(() => useTokenLifecycle());

      act(() => {
        triggerAccessTokenExpiring();
      });

      expect(result.current.isSessionExpiring).toBe(true);

      await act(async () => {
        triggerAccessTokenExpired();
      });

      expect(result.current.isSessionExpiring).toBe(false);
    });
  });

  describe('silent renew error event', () => {
    it('calls onRenewalFailed on silent renew error', async () => {
      const onRenewalFailed = vi.fn();
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      renderHook(() => useTokenLifecycle({ onRenewalFailed }));

      await act(async () => {
        triggerSilentRenewError(new Error('Silent renewal failed'));
      });

      expect(onRenewalFailed).toHaveBeenCalledWith(expect.any(Error));
      expect(mockRemoveUser).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe('extendSession', () => {
    it('calls signinSilent', async () => {
      mockSigninSilent.mockResolvedValue({});

      const { result } = renderHook(() => useTokenLifecycle());

      await act(async () => {
        await result.current.extendSession();
      });

      expect(mockSigninSilent).toHaveBeenCalled();
    });

    it('resets isSessionExpiring on success', async () => {
      mockSigninSilent.mockResolvedValue({});

      const { result } = renderHook(() => useTokenLifecycle());

      // First trigger expiring
      act(() => {
        triggerAccessTokenExpiring();
      });
      expect(result.current.isSessionExpiring).toBe(true);

      // Then extend session successfully
      await act(async () => {
        await result.current.extendSession();
      });

      expect(result.current.isSessionExpiring).toBe(false);
    });
  });

  describe('endSession', () => {
    it('calls removeUser', async () => {
      const { result } = renderHook(() => useTokenLifecycle());

      await act(async () => {
        await result.current.endSession();
      });

      expect(mockRemoveUser).toHaveBeenCalled();
    });

    it('resets session state', async () => {
      const { result } = renderHook(() => useTokenLifecycle());

      // First set expiring state
      act(() => {
        triggerAccessTokenExpiring();
      });

      await act(async () => {
        await result.current.endSession();
      });

      expect(result.current.isSessionExpiring).toBe(false);
      expect(result.current.secondsUntilExpiry).toBeNull();
    });

    it('navigates to home if on admin route', async () => {
      // Mock window.location.pathname
      const originalLocation = window.location;
      Object.defineProperty(window, 'location', {
        writable: true,
        value: { ...originalLocation, pathname: '/app/admin/users' },
      });

      const { result } = renderHook(() => useTokenLifecycle());

      await act(async () => {
        await result.current.endSession();
      });

      expect(mockNavigate).toHaveBeenCalledWith('/');

      // Restore
      Object.defineProperty(window, 'location', {
        writable: true,
        value: originalLocation,
      });
    });
  });

  describe('edge cases', () => {
    it('handles missing user gracefully', () => {
      mockAuth = createMockAuth({ user: null, isAuthenticated: false });

      const { result } = renderHook(() => useTokenLifecycle());

      expect(result.current.isSessionExpiring).toBe(false);
    });

    it('handles loading state gracefully', () => {
      mockAuth = createMockAuth({ isLoading: true });

      renderHook(() => useTokenLifecycle());

      // Should not throw or call removeUser
      expect(mockRemoveUser).not.toHaveBeenCalled();
    });
  });
});
