import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { AuthContext, AuthContextProps } from 'react-oidc-context';
import { ReactNode } from 'react';
import { useNotifications } from '../useNotifications';
import { Notification, NotificationType, NotificationEntityType } from '../../../api/soroban-security-portal/models/notification';

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('../../../api/soroban-security-portal/soroban-security-portal-api', () => ({
  getNotificationsCall: vi.fn(),
  getUnreadCountCall: vi.fn(),
  markNotificationReadCall: vi.fn(),
  markAllNotificationsReadCall: vi.fn(),
}));

// Fake connection returned by createNotificationConnection
const fakeConnection = {
  start: vi.fn().mockResolvedValue(undefined),
  on: vi.fn(),
  off: vi.fn(),
  onreconnected: vi.fn(),
  stop: vi.fn().mockResolvedValue(undefined),
};

vi.mock('../notificationConnection', () => ({
  createNotificationConnection: vi.fn(() => fakeConnection),
}));

// ---------------------------------------------------------------------------
// Typed imports AFTER mocks
// ---------------------------------------------------------------------------

import {
  getNotificationsCall,
  getUnreadCountCall,
  markNotificationReadCall,
  markAllNotificationsReadCall,
} from '../../../api/soroban-security-portal/soroban-security-portal-api';

const mockGetNotifications = getNotificationsCall as ReturnType<typeof vi.fn>;
const mockGetUnreadCount = getUnreadCountCall as ReturnType<typeof vi.fn>;
const mockMarkRead = markNotificationReadCall as ReturnType<typeof vi.fn>;
const mockMarkAllRead = markAllNotificationsReadCall as ReturnType<typeof vi.fn>;

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

const SAMPLE_NOTIFICATIONS: Notification[] = [
  {
    id: 1,
    type: NotificationType.CommentReply,
    actorUserId: 10,
    actorName: 'Alice',
    commentId: 100,
    entityType: NotificationEntityType.Vulnerability,
    entityId: 5,
    preview: 'Nice finding!',
    isRead: false,
    createdAt: '2026-05-26T10:00:00Z',
  },
  {
    id: 2,
    type: NotificationType.Mention,
    actorUserId: 11,
    actorName: 'Bob',
    commentId: 101,
    entityType: NotificationEntityType.Report,
    entityId: 7,
    preview: '@you check this',
    isRead: true,
    createdAt: '2026-05-26T09:00:00Z',
  },
];

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
  settings: {} as AuthContextProps['settings'],
  events: {} as AuthContextProps['events'],
  ...overrides,
});

const authenticatedAuth = createMockAuth({
  isAuthenticated: true,
  user: {
    access_token: 'test-access-token',
    token_type: 'Bearer',
    profile: { sub: '42', name: 'Test User' },
    expires_at: Date.now() / 1000 + 3600,
    expired: false,
    scopes: ['openid'],
  } as AuthContextProps['user'],
});

const createWrapper = (auth: AuthContextProps) => {
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>
  );
  Wrapper.displayName = 'NotificationsTestWrapper';
  return Wrapper;
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useNotifications', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fakeConnection.start.mockResolvedValue(undefined);
    fakeConnection.stop.mockResolvedValue(undefined);
    fakeConnection.on.mockReset();
    fakeConnection.off.mockReset();
    mockGetNotifications.mockResolvedValue(SAMPLE_NOTIFICATIONS);
    mockGetUnreadCount.mockResolvedValue(3);
    mockMarkRead.mockResolvedValue(undefined);
    mockMarkAllRead.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // -------------------------------------------------------------------------
  // (a) seeds notifications + unreadCount from REST after mount
  // -------------------------------------------------------------------------
  describe('initial data loading', () => {
    it('seeds notifications from getNotificationsCall on mount', async () => {
      const { result } = renderHook(() => useNotifications(), {
        wrapper: createWrapper(authenticatedAuth),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(mockGetNotifications).toHaveBeenCalledTimes(1);
      expect(result.current.notifications).toHaveLength(SAMPLE_NOTIFICATIONS.length);
      expect(result.current.notifications[0].id).toBe(1);
      expect(result.current.notifications[1].id).toBe(2);
    });

    it('seeds unreadCount from getUnreadCountCall on mount', async () => {
      const { result } = renderHook(() => useNotifications(), {
        wrapper: createWrapper(authenticatedAuth),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(mockGetUnreadCount).toHaveBeenCalledTimes(1);
      expect(result.current.unreadCount).toBe(3);
    });

    it('does not call API when not authenticated', async () => {
      const unauthAuth = createMockAuth({ isAuthenticated: false });
      renderHook(() => useNotifications(), {
        wrapper: createWrapper(unauthAuth),
      });

      // Give time for any erroneous async calls to fire
      await new Promise((r) => setTimeout(r, 20));

      expect(mockGetNotifications).not.toHaveBeenCalled();
      expect(mockGetUnreadCount).not.toHaveBeenCalled();
    });

    it('starts in loading=true state', () => {
      mockGetNotifications.mockReturnValue(new Promise(() => {}));
      mockGetUnreadCount.mockReturnValue(new Promise(() => {}));

      const { result } = renderHook(() => useNotifications(), {
        wrapper: createWrapper(authenticatedAuth),
      });

      expect(result.current.loading).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // (b) ReceiveNotification handler: prepends + increments unread
  // -------------------------------------------------------------------------
  describe('ReceiveNotification SignalR event', () => {
    it('prepends a new notification and increments unreadCount', async () => {
      const { result } = renderHook(() => useNotifications(), {
        wrapper: createWrapper(authenticatedAuth),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      // Grab the handler registered under 'ReceiveNotification'
      const onCalls: [string, (n: Notification) => void][] =
        fakeConnection.on.mock.calls;
      const receiveHandler = onCalls.find(([event]) => event === 'ReceiveNotification')?.[1];
      expect(receiveHandler).toBeDefined();

      const newNotification: Notification = {
        id: 99,
        type: NotificationType.Mention,
        actorUserId: 20,
        actorName: 'Charlie',
        commentId: 200,
        entityType: NotificationEntityType.Vulnerability,
        entityId: 3,
        preview: 'Hey @you',
        isRead: false,
        createdAt: '2026-05-26T11:00:00Z',
      };

      act(() => {
        receiveHandler!(newNotification);
      });

      expect(result.current.notifications[0].id).toBe(99);
      expect(result.current.notifications).toHaveLength(SAMPLE_NOTIFICATIONS.length + 1);
      expect(result.current.unreadCount).toBe(4); // 3 + 1
    });

    it('re-seeds from REST after the connection reconnects', async () => {
      const { result } = renderHook(() => useNotifications(), {
        wrapper: createWrapper(authenticatedAuth),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      const initialFetches = mockGetNotifications.mock.calls.length;

      // Grab the handler registered via onreconnected and invoke it
      const reconnectHandler = fakeConnection.onreconnected.mock.calls[0]?.[0] as
        | (() => void)
        | undefined;
      expect(reconnectHandler).toBeDefined();

      await act(async () => {
        reconnectHandler!();
        await Promise.resolve();
      });

      await waitFor(() =>
        expect(mockGetNotifications.mock.calls.length).toBeGreaterThan(initialFetches),
      );
    });
  });

  // -------------------------------------------------------------------------
  // (c) markRead calls REST and decrements count
  // -------------------------------------------------------------------------
  describe('markRead', () => {
    it('calls markNotificationReadCall with the notification id', async () => {
      const { result } = renderHook(() => useNotifications(), {
        wrapper: createWrapper(authenticatedAuth),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      await act(async () => {
        await result.current.markRead(1);
      });

      expect(mockMarkRead).toHaveBeenCalledWith(1);
    });

    it('sets the notification isRead=true after markRead', async () => {
      const { result } = renderHook(() => useNotifications(), {
        wrapper: createWrapper(authenticatedAuth),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      await act(async () => {
        await result.current.markRead(1);
      });

      const updated = result.current.notifications.find((n) => n.id === 1);
      expect(updated?.isRead).toBe(true);
    });

    it('decrements unreadCount after markRead', async () => {
      const { result } = renderHook(() => useNotifications(), {
        wrapper: createWrapper(authenticatedAuth),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));
      expect(result.current.unreadCount).toBe(3);

      await act(async () => {
        await result.current.markRead(1);
      });

      expect(result.current.unreadCount).toBe(2);
    });

    it('floors unreadCount at 0 (never negative)', async () => {
      mockGetUnreadCount.mockResolvedValue(0);

      const { result } = renderHook(() => useNotifications(), {
        wrapper: createWrapper(authenticatedAuth),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));
      expect(result.current.unreadCount).toBe(0);

      await act(async () => {
        await result.current.markRead(1);
      });

      expect(result.current.unreadCount).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // (d) unmount calls connection.stop()
  // -------------------------------------------------------------------------
  describe('cleanup on unmount', () => {
    it('calls connection.stop() on unmount', async () => {
      const { result, unmount } = renderHook(() => useNotifications(), {
        wrapper: createWrapper(authenticatedAuth),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      unmount();

      await waitFor(() => expect(fakeConnection.stop).toHaveBeenCalledTimes(1));
    });

    it('calls connection.off() for ReceiveNotification on unmount', async () => {
      const { result, unmount } = renderHook(() => useNotifications(), {
        wrapper: createWrapper(authenticatedAuth),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      unmount();

      await waitFor(() => {
        const offCalls: string[] = fakeConnection.off.mock.calls.map(
          ([event]: [string]) => event,
        );
        expect(offCalls).toContain('ReceiveNotification');
      });
    });
  });

  // -------------------------------------------------------------------------
  // markAllRead
  // -------------------------------------------------------------------------
  describe('markAllRead', () => {
    it('calls markAllNotificationsReadCall', async () => {
      const { result } = renderHook(() => useNotifications(), {
        wrapper: createWrapper(authenticatedAuth),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      await act(async () => {
        await result.current.markAllRead();
      });

      expect(mockMarkAllRead).toHaveBeenCalledTimes(1);
    });

    it('marks all notifications as read and zeroes unreadCount', async () => {
      const { result } = renderHook(() => useNotifications(), {
        wrapper: createWrapper(authenticatedAuth),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));

      await act(async () => {
        await result.current.markAllRead();
      });

      expect(result.current.unreadCount).toBe(0);
      result.current.notifications.forEach((n) => {
        expect(n.isRead).toBe(true);
      });
    });
  });

  // -------------------------------------------------------------------------
  // reload
  // -------------------------------------------------------------------------
  describe('reload', () => {
    it('re-fetches notifications and unread count', async () => {
      const { result } = renderHook(() => useNotifications(), {
        wrapper: createWrapper(authenticatedAuth),
      });

      await waitFor(() => expect(result.current.loading).toBe(false));
      expect(mockGetNotifications).toHaveBeenCalledTimes(1);

      await act(async () => {
        await result.current.reload();
      });

      expect(mockGetNotifications).toHaveBeenCalledTimes(2);
      expect(mockGetUnreadCount).toHaveBeenCalledTimes(2);
    });
  });
});
