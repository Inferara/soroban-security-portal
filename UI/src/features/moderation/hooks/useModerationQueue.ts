import { useState, useEffect, useMemo } from 'react';
import { FlaggedContent, ModerationStats } from '../types';

const MOCK_DATA: FlaggedContent[] = [
    {
        id: '1',
        contentType: 'comment',
        contentId: 'c123',
        contentPreview: 'This project is a scam!',
        fullContent: 'This project is a complete scam, do not invest! I heard the devs are running away.',
        author: {
            id: 'u1',
            name: 'AngryUser99',
            email: 'angry@example.com',
            reputationScore: 12,
            avatarUrl: ''
        },
        flagCount: 5,
        reasons: { spam: 1, misinformation: 3, harassment: 1, inappropriate: 0, other: 0 },
        firstFlaggedAt: new Date(Date.now() - 86400000 * 2).toISOString(),
        lastFlaggedAt: new Date(Date.now() - 3600000).toISOString(),
        status: 'pending',
        moderationHistory: []
    },
    {
        id: '2',
        contentType: 'report',
        contentId: 'r456',
        contentPreview: 'Vulnerability in Smart Contract',
        fullContent: 'I found a critical vulnerability...',
        author: {
            id: 'u2',
            name: 'SecurityResearcher',
            email: 'sec@research.com',
            reputationScore: 150,
            avatarUrl: ''
        },
        flagCount: 1,
        reasons: { spam: 1, misinformation: 0, harassment: 0, inappropriate: 0, other: 0 },
        firstFlaggedAt: new Date(Date.now() - 86400000).toISOString(),
        lastFlaggedAt: new Date(Date.now() - 86400000).toISOString(),
        status: 'pending',
        moderationHistory: []
    },
    {
        id: '3',
        contentType: 'user_profile',
        contentId: 'u789',
        contentPreview: 'Bot Account 123',
        fullContent: 'Bio with spam links: visit myspamlink.com',
        author: {
            id: 'u3',
            name: 'BotAccount123',
            email: 'bot@spam.com',
            reputationScore: 0,
        },
        flagCount: 15,
        reasons: { spam: 15, misinformation: 0, harassment: 0, inappropriate: 0, other: 0 },
        firstFlaggedAt: new Date(Date.now() - 86400000 * 5).toISOString(),
        lastFlaggedAt: new Date(Date.now() - 10000).toISOString(),
        status: 'pending',
        moderationHistory: []
    }
];

const BASE_STATS = {
    actionsToday: 12,
    actionsThisWeek: 45,
    actionsThisMonth: 128,
};

export const useModerationQueue = () => {
    const [items, setItems] = useState<FlaggedContent[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Simulate API call
        setTimeout(() => {
            setItems(MOCK_DATA);
            setLoading(false);
        }, 1000);
    }, []);

    const handleAction = (id: string, action: 'approve' | 'hide' | 'delete', reason?: string) => {
        setItems(prev => prev.map(item => {
            if (item.id === id) {
                let newStatus: 'approved' | 'hidden' | 'deleted' | 'pending' = 'pending';
                switch (action) {
                    case 'approve': newStatus = 'approved'; break;
                    case 'hide': newStatus = 'hidden'; break;
                    case 'delete': newStatus = 'deleted'; break;
                }
                return { ...item, status: newStatus, lastAction: { action, reason } };
            }
            return item;
        }));
        // TODO: Backend Integration (Issue #87)
        // This will be replaced with: await api.moderation.takeAction(id, action, reason);
    };

    // Derive stats purely from items — no stale-closure risk
    const stats: ModerationStats | null = useMemo(() => {
        if (loading) return null;
        const pendingCount = items.filter(i => i.status === 'pending').length;
        const processedCount = items.filter(i => i.status !== 'pending').length;
        return {
            queueSize: pendingCount,
            actionsToday: BASE_STATS.actionsToday + processedCount,
            actionsThisWeek: BASE_STATS.actionsThisWeek + processedCount,
            actionsThisMonth: BASE_STATS.actionsThisMonth + processedCount,
        };
    }, [items, loading]);

    return { items, stats, loading, handleAction };
};
