import { useState, useEffect, useCallback } from 'react';
import { FlaggedContent, ModerationStats } from '../types';
import {
    getModerationQueueCall,
    getModerationStatsCall,
    takeModerationActionCall,
} from '../../../api/soroban-security-portal/soroban-security-portal-api';
import { showError } from '../../dialog-handler/dialog-handler';

export const useModerationQueue = () => {
    const [items, setItems] = useState<FlaggedContent[]>([]);
    const [stats, setStats] = useState<ModerationStats | null>(null);
    const [loading, setLoading] = useState(true);

    const refetch = useCallback(async () => {
        try {
            const [queueItems, queueStats] = await Promise.all([
                getModerationQueueCall(),
                getModerationStatsCall(),
            ]);
            setItems(queueItems);
            setStats(queueStats);
        } catch (error) {
            showError('Failed to load moderation queue. Please try again.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        refetch();
    }, [refetch]);

    const handleAction = async (id: string, action: 'approve' | 'hide' | 'delete', reason?: string) => {
        const [contentType, contentIdStr] = id.split(':');
        const contentId = Number(contentIdStr);
        if (!contentType || Number.isNaN(contentId)) {
            showError('Invalid moderation item');
            return;
        }
        try {
            await takeModerationActionCall(contentType, contentId, action, reason);
            await refetch();
        } catch (error) {
            showError('Failed to perform moderation action. Please try again.');
        }
    };

    return { items, stats, loading, handleAction, refetch };
};
