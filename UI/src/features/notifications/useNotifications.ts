import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from 'react-oidc-context';
import { HubConnection } from '@microsoft/signalr';
import { Notification } from '../../api/soroban-security-portal/models/notification';
import {
  getNotificationsCall,
  getUnreadCountCall,
  markNotificationReadCall,
  markAllNotificationsReadCall,
} from '../../api/soroban-security-portal/soroban-security-portal-api';
import { createNotificationConnection } from './notificationConnection';

export interface UseNotificationsResult {
  notifications: Notification[];
  unreadCount: number;
  loading: boolean;
  markRead: (id: number) => Promise<void>;
  markAllRead: () => Promise<void>;
  reload: () => Promise<void>;
}

export const useNotifications = (): UseNotificationsResult => {
  const auth = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);

  // Stable ref so we can call the latest fetch inside the SignalR handler
  const connectionRef = useRef<HubConnection | null>(null);
  const mountedRef = useRef(true);

  const fetchData = useCallback(async () => {
    if (!auth.isAuthenticated) return;
    setLoading(true);
    try {
      const [items, count] = await Promise.all([
        getNotificationsCall(undefined, 1),
        getUnreadCountCall(),
      ]);
      if (!mountedRef.current) return;
      setNotifications(items);
      setUnreadCount(count);
    } catch (err) {
      console.error('[useNotifications] fetch error:', err);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [auth.isAuthenticated]);

  useEffect(() => {
    mountedRef.current = true;

    if (!auth.isAuthenticated) return;

    // Fetch initial data
    fetchData();

    // Build SignalR connection
    const connection = createNotificationConnection(() => auth.user?.access_token);
    connectionRef.current = connection;

    const handleReceive = (n: Notification) => {
      if (!mountedRef.current) return;
      setNotifications((prev) => [n, ...prev]);
      setUnreadCount((prev) => prev + 1);
    };

    connection.on('ReceiveNotification', handleReceive);

    // After an automatic reconnect, re-seed from REST so any notifications that
    // arrived while the socket was down are not missed.
    connection.onreconnected(() => {
      fetchData();
    });

    connection.start().catch((err: unknown) => {
      console.error('[useNotifications] connection error:', err);
    });

    return () => {
      mountedRef.current = false;
      connection.off('ReceiveNotification', handleReceive);
      connection.stop().catch((err: unknown) => {
        console.error('[useNotifications] stop error:', err);
      });
      connectionRef.current = null;
    };
  }, [auth.isAuthenticated, auth.user?.access_token]);

  const markRead = useCallback(async (id: number) => {
    await markNotificationReadCall(id);
    if (!mountedRef.current) return;
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)),
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));
  }, []);

  const markAllRead = useCallback(async () => {
    await markAllNotificationsReadCall();
    if (!mountedRef.current) return;
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnreadCount(0);
  }, []);

  const reload = useCallback(async () => {
    await fetchData();
  }, [fetchData]);

  return { notifications, unreadCount, loading, markRead, markAllRead, reload };
};
