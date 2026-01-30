import { useEffect, useState, useCallback } from 'react';
import { signalRService } from '../api/signalr-service';
import { HubConnectionState } from '@microsoft/signalr';

export const useSignalR = (hubUrl: string, tokenProvider?: () => Promise<string | null>) => {
    const [connectionState, setConnectionState] = useState<HubConnectionState>(HubConnectionState.Disconnected);

    useEffect(() => {
        if (tokenProvider) {
            signalRService.setTokenProvider(tokenProvider);
        }

        const connect = async () => {
            // Initial connection
            try {
                await signalRService.startConnection(hubUrl);
                setConnectionState(signalRService.getConnectionState());
            } catch (e) {
                console.error(e);
            }
        };

        connect();

    }, [hubUrl, tokenProvider]);

    const invoke = useCallback(async (methodName: string, ...args: any[]) => {
        return await signalRService.invoke(methodName, ...args);
    }, []);

    const on = useCallback((methodName: string, callback: (...args: any[]) => void) => {
        signalRService.on(methodName, callback);
        // Return a cleanup function for useEffect usage in components
        return () => signalRService.off(methodName, callback);
    }, []);

    // Helper hook for subscribing to events easily
    // usage: useSignalRListener('ReceiveMessage', (msg) => { ... });
    const useSignalRListener = (methodName: string, callback: (...args: any[]) => void) => {
        useEffect(() => {
            signalRService.on(methodName, callback);
            return () => {
                signalRService.off(methodName, callback);
            };
        }, [methodName, callback]);
    };

    return {
        isConnected: connectionState === HubConnectionState.Connected,
        connectionState,
        invoke,
        on,
        useSignalRListener
    };
};
