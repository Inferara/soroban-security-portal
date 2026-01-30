import {
    changePasswordCall,
    getUserByIdCall,
    getWatchedThreadsCall,
    watchThreadCall
} from '../../../../../api/soroban-security-portal/soroban-security-portal-api';
import { UserItem } from '../../../../../api/soroban-security-portal/models/user';
import { Thread } from '../../../../../api/soroban-security-portal/models/thread';
import { useEffect, useState } from 'react';

export const useProfile = () => {
    const userId = 0; // Assuming 0 is the current user if no userId param
    const [user, setUser] = useState<UserItem | null>(null);
    const [watchedThreads, setWatchedThreads] = useState<Thread[]>([]);
    const [threadsLoading, setThreadsLoading] = useState(false);

    const changePassword = async (oldPassword: string, newPassword: string): Promise<boolean> => {
        const changePasswordResponse = await changePasswordCall(oldPassword, newPassword);
        return changePasswordResponse;
    };

    const getUserById = async (): Promise<void> => {
        const userResponse = await getUserByIdCall(userId);
        if (userResponse) {
            setUser(userResponse);
        }
    };

    const getWatchedThreads = async (): Promise<void> => {
        setThreadsLoading(true);
        try {
            const threads = await getWatchedThreadsCall();
            setWatchedThreads(threads);
        } catch (error) {
            console.error('Failed to fetch watched threads', error);
        } finally {
            setThreadsLoading(false);
        }
    };

    const toggleWatch = async (threadId: number, isWatching: boolean): Promise<void> => {
        try {
            await watchThreadCall(threadId, isWatching);
            await getWatchedThreads();
        } catch (error) {
            console.error('Failed to toggle watch', error);
        }
    };

    useEffect(() => {
        void getUserById();
        void getWatchedThreads();
    }, [userId]);

    return {
        changePassword,
        user,
        userId,
        watchedThreads,
        threadsLoading,
        toggleWatch,
        refreshThreads: getWatchedThreads
    };
};