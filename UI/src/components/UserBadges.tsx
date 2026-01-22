import { Box, Stack } from '@mui/material';
import { UserBadge } from '../api/soroban-security-portal/models/badge';
import { BadgeIcon } from './BadgeIcon';

interface UserBadgesProps {
    badges: UserBadge[];
    mode?: 'compact' | 'full';
    maxBadges?: number;
    size?: 'small' | 'medium' | 'large';
}

export function UserBadges({ badges, mode = 'compact', maxBadges, size = 'small' }: UserBadgesProps) {
    // Sort badges by rarity (legendary first) and award date
    const sortedBadges = [...badges].sort((a, b) => {
        const rarityOrder = { legendary: 0, epic: 1, rare: 2, common: 3 };
        const rarityDiff = rarityOrder[a.rarity] - rarityOrder[b.rarity];
        if (rarityDiff !== 0) return rarityDiff;
        return new Date(b.awardedAt).getTime() - new Date(a.awardedAt).getTime();
    });

    const displayBadges = maxBadges ? sortedBadges.slice(0, maxBadges) : sortedBadges;

    if (mode === 'compact') {
        return (
            <Stack direction="row" spacing={0.5} alignItems="center">
                {displayBadges.map((badge) => (
                    <BadgeIcon key={badge.id} badge={badge} size={size} />
                ))}
                {maxBadges && badges.length > maxBadges && (
                    <Box
                        sx={{
                            fontSize: '0.75rem',
                            color: '#666',
                            ml: 0.5,
                        }}
                    >
                        +{badges.length - maxBadges}
                    </Box>
                )}
            </Stack>
        );
    }

    return (
        <Box
            sx={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))',
                gap: 2,
            }}
        >
            {displayBadges.map((badge) => (
                <Box
                    key={badge.id}
                    sx={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: 0.5,
                    }}
                >
                    <BadgeIcon badge={badge} size={size} />
                    <Box
                        sx={{
                            fontSize: '0.75rem',
                            textAlign: 'center',
                            color: badge.isLocked ? '#999' : '#333',
                        }}
                    >
                        {badge.name}
                    </Box>
                </Box>
            ))}
        </Box>
    );
}
