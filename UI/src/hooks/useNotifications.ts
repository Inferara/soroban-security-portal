import { useState, useEffect, useCallback, useRef } from 'react';
import { HubConnectionBuilder, HubConnection, HubConnectionState, LogLevel } from '@microsoft/signalr';
import { useAuth } from 'react-oidc-context';
import { environment } from '../environments/environment';
import { Notification } from '../api/soroban-security-portal/models/notification';

export const useNotifications = () => {
    const { user } = useAuth();
    const token = user?.access_token;
    const [connection, setConnection] = useState<HubConnection | null>(null);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [connectionStatus, setConnectionStatus] = useState<HubConnectionState>(HubConnectionState.Disconnected);

    // Use ref to track connection initialization to prevent double connects in strict mode
    const isConnecting = useRef(false);

    useEffect(() => {
        if (!token) return;

        const connect = async () => {
            if (isConnecting.current) return;
            isConnecting.current = true;

            const newConnection = new HubConnectionBuilder()
                .withUrl(`${environment.apiUrl}/hubs/notifications`, {
                    accessTokenFactory: () => token
                })
                .withAutomaticReconnect()
                .configureLogging(LogLevel.Information)
                .build();

            setConnection(newConnection);

            try {
                await newConnection.start();
                console.log('SignalR Connected!');
                setConnectionStatus(HubConnectionState.Connected);

                // Subscribe to events
                newConnection.on('ReceiveNotification', (notification: Notification) => {
                    setNotifications(prev => {
                        // Avoid duplicates
                        if (prev.find(n => n.id === notification.id)) return prev;
                        return [notification, ...prev].slice(0, 50); // Keep last 50
                    });
                    setUnreadCount(prev => prev + 1);
                });

                // Request initial state if needed, or assume backend pushes current state on connect
                // await newConnection.invoke("GetRecentNotifications"); 

            } catch (err) {
                console.error('SignalR Connection Error: ', err);
                setConnectionStatus(HubConnectionState.Disconnected);
            } finally {
                isConnecting.current = false;
            }
        };

        connect();

        return () => {
            if (connection) {
                connection.stop();
            }
        };
    }, [token]);

    const markAsRead = useCallback(async (id: string) => {
        setNotifications(prev => prev.map(n =>
            n.id === id ? { ...n, isRead: true } : n
        ));
        setUnreadCount(prev => Math.max(0, prev - 1));

        // Call backend
        try {
            // await axios.post(`${environment.apiUrl}/api/notifications/${id}/read`);
            if (connection?.state === HubConnectionState.Connected) {
                await connection.invoke("MarkAsRead", id);
            }
        } catch (error) {
            console.error("Failed to mark notification as read", error);
        }
    }, [connection]);

    const markAllAsRead = useCallback(async () => {
        setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
        setUnreadCount(0);

        try {
            if (connection?.state === HubConnectionState.Connected) {
                await connection.invoke("MarkAllAsRead");
            }
        } catch (error) {
            console.error("Failed to mark all as read", error);
        }
    }, [connection]);

    return {
        notifications,
        unreadCount,
        isConnected: connectionStatus === HubConnectionState.Connected,
        markAsRead,
        markAllAsRead
    };
};
