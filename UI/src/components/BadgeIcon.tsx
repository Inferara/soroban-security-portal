import { Tooltip, Box } from '@mui/material';
import { UserBadge, BadgeRarity } from '../api/soroban-security-portal/models/badge';
import { format } from 'date-fns';

interface BadgeIconProps {
    badge: UserBadge;
    size?: 'small' | 'medium' | 'large';
    showTooltip?: boolean;
}

const rarityColors: Record<BadgeRarity, string> = {
    [BadgeRarity.COMMON]: '#9E9E9E',
    [BadgeRarity.RARE]: '#2196F3',
    [BadgeRarity.EPIC]: '#9C27B0',
    [BadgeRarity.LEGENDARY]: '#FF9800',
};

const sizeMap = {
    small: 24,
    medium: 32,
    large: 48,
};

export function BadgeIcon({ badge, size = 'medium', showTooltip = true }: BadgeIconProps) {
    const badgeSize = sizeMap[size];
    const isLocked = badge.isLocked || false;

    const badgeElement = (
        <Box
            sx={{
                width: badgeSize,
                height: badgeSize,
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: isLocked ? '#E0E0E0' : rarityColors[badge.rarity],
                color: '#fff',
                fontWeight: 'bold',
                fontSize: badgeSize * 0.5,
                boxShadow: isLocked ? 'none' : `0 2px 8px ${rarityColors[badge.rarity]}40`,
                transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                cursor: 'pointer',
                opacity: isLocked ? 0.5 : 1,
                '&:hover': {
                    transform: isLocked ? 'none' : 'scale(1.1)',
                    boxShadow: isLocked ? 'none' : `0 4px 12px ${rarityColors[badge.rarity]}60`,
                },
            }}
        >
            {badge.icon || badge.name.charAt(0).toUpperCase()}
        </Box>
    );

    if (!showTooltip) {
        return badgeElement;
    }

    const tooltipContent = (
        <Box>
            <Box sx={{ fontWeight: 'bold', mb: 0.5 }}>{badge.name}</Box>
            <Box sx={{ fontSize: '0.875rem', mb: 0.5 }}>{badge.description}</Box>
            {!badge.isLocked && (
                <Box sx={{ fontSize: '0.75rem', color: '#B0B0B0', mt: 0.5 }}>
                    Awarded: {format(new Date(badge.awardedAt), 'MMM dd, yyyy')}
                </Box>
            )}
            {badge.isLocked && badge.progress !== undefined && (
                <Box sx={{ fontSize: '0.75rem', color: '#B0B0B0', mt: 0.5 }}>
                    Progress: {badge.progress}%
                </Box>
            )}
        </Box>
    );

    return (
        <Tooltip title={tooltipContent} arrow placement="top">
            {badgeElement}
        </Tooltip>
    );
}
