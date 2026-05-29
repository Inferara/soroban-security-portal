import { Tooltip, Box } from '@mui/material';
import { useTheme } from '@mui/material/styles';
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
    const theme = useTheme();
    const badgeSize = sizeMap[size];
    const isLocked = badge.isLocked || false;

    // L-5: use badge.color when present, fall back to rarity-based color
    const activeColor = badge.color || rarityColors[badge.rarity];

    const badgeElement = (
        <Box
            role="img"
            aria-label={`${badge.name}: ${badge.description}`}
            tabIndex={0}
            sx={{
                width: badgeSize,
                height: badgeSize,
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                // M-3: locked bg uses theme token instead of hardcoded #E0E0E0
                backgroundColor: isLocked ? theme.palette.action.disabledBackground : activeColor,
                // Locked bg is a light gray; white text would be unreadable, so use a theme token.
                // Earned badge has a colored circle bg where white reads well.
                color: isLocked ? theme.palette.text.disabled : '#fff',
                fontWeight: 'bold',
                fontSize: badgeSize * 0.5,
                boxShadow: isLocked ? 'none' : `0 2px 8px ${activeColor}40`,
                transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                cursor: 'pointer',
                opacity: isLocked ? 0.5 : 1,
                '&:hover': {
                    transform: isLocked ? 'none' : 'scale(1.1)',
                    boxShadow: isLocked ? 'none' : `0 4px 12px ${activeColor}60`,
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
                // M-3: replaced hardcoded #B0B0B0 with theme token
                <Box sx={{ fontSize: '0.75rem', color: 'text.disabled', mt: 0.5 }}>
                    Awarded: {format(new Date(badge.awardedAt), 'MMM dd, yyyy')}
                </Box>
            )}
            {badge.isLocked && badge.progress !== undefined && (
                // M-3: replaced hardcoded #B0B0B0 with theme token
                <Box sx={{ fontSize: '0.75rem', color: 'text.disabled', mt: 0.5 }}>
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
