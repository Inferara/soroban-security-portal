import { useState, useEffect } from 'react';
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
            avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Angry'
        },
        flagCount: 5,
        reasons: { spam: 1, misinformation: 3, harassment: 1 } as any,
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
            avatarUrl: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Sec'
        },
        flagCount: 1,
        reasons: { spam: 1 } as any,
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
        reasons: { spam: 15 } as any,
        firstFlaggedAt: new Date(Date.now() - 86400000 * 5).toISOString(),
        lastFlaggedAt: new Date(Date.now() - 10000).toISOString(),
        status: 'pending',
        moderationHistory: []
    }
];

const MOCK_STATS: ModerationStats = {
    queueSize: 3,
    actionsToday: 12,
    actionsThisWeek: 45,
    actionsThisMonth: 128,
    flagBreakdown: { spam: 65, harassment: 12, inappropriate: 15, misinformation: 8, other: 5 }
};

export const useModerationQueue = () => {
    const [items, setItems] = useState<FlaggedContent[]>([]);
    const [stats, setStats] = useState<ModerationStats | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Simulate API call
        setTimeout(() => {
            setItems(MOCK_DATA);
            setStats(MOCK_STATS);
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
                return { ...item, status: newStatus };
            }
            return item;
        }));
        // TODO: Backend Integration (Issue #87)
        // This will be replaced with: await api.moderation.takeAction(id, action, reason);
        void reason; // Suppress unused var check for mock
    };

    // Update stats when items change
    useEffect(() => {
        if (!loading && stats) {
            const pendingCount = items.filter(i => i.status === 'pending').length;
            const processedCount = items.filter(i => i.status !== 'pending').length;
            
            setStats(prev => {
                if (!prev) return null;
                return {
                    ...prev,
                    queueSize: pendingCount,
                    actionsToday: MOCK_STATS.actionsToday + processedCount,
                    actionsThisWeek: MOCK_STATS.actionsThisWeek + processedCount,
                    actionsThisMonth: MOCK_STATS.actionsThisMonth + processedCount
                };
            });
        }
    }, [items, loading, stats]);

    return { items, stats, loading, handleAction };
};
