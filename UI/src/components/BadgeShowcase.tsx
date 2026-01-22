import { Box, Typography, Tabs, Tab, LinearProgress, Paper } from '@mui/material';
import { useState } from 'react';
import { UserBadge, BadgeCategory } from '../api/soroban-security-portal/models/badge';
import { BadgeIcon } from './BadgeIcon';
import { format } from 'date-fns';

interface BadgeShowcaseProps {
    badges: UserBadge[];
}

export function BadgeShowcase({ badges }: BadgeShowcaseProps) {
    const [selectedCategory, setSelectedCategory] = useState<BadgeCategory | 'all'>('all');

    const filteredBadges =
        selectedCategory === 'all'
            ? badges
            : badges.filter((badge) => badge.category === selectedCategory);

    const earnedBadges = filteredBadges.filter((b) => !b.isLocked);
    const lockedBadges = filteredBadges.filter((b) => b.isLocked);

    const categoryStats = {
        [BadgeCategory.ACHIEVEMENT]: badges.filter((b) => b.category === BadgeCategory.ACHIEVEMENT && !b.isLocked).length,
        [BadgeCategory.CONTRIBUTION]: badges.filter((b) => b.category === BadgeCategory.CONTRIBUTION && !b.isLocked).length,
        [BadgeCategory.SPECIAL]: badges.filter((b) => b.category === BadgeCategory.SPECIAL && !b.isLocked).length,
    };

    return (
        <Paper sx={{ p: 3 }}>
            <Typography variant="h5" sx={{ mb: 2, fontWeight: 'bold' }}>
                Badge Collection
            </Typography>

            <Box sx={{ mb: 3 }}>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    {earnedBadges.length} / {badges.length} Badges Earned
                </Typography>
                <LinearProgress
                    variant="determinate"
                    value={(earnedBadges.length / badges.length) * 100}
                    sx={{ height: 8, borderRadius: 4 }}
                />
            </Box>

            <Tabs
                value={selectedCategory}
                onChange={(_, value) => setSelectedCategory(value)}
                sx={{ mb: 3, borderBottom: 1, borderColor: 'divider' }}
            >
                <Tab label={`All (${badges.length})`} value="all" />
                <Tab
                    label={`Achievement (${categoryStats[BadgeCategory.ACHIEVEMENT]})`}
                    value={BadgeCategory.ACHIEVEMENT}
                />
                <Tab
                    label={`Contribution (${categoryStats[BadgeCategory.CONTRIBUTION]})`}
                    value={BadgeCategory.CONTRIBUTION}
                />
                <Tab
                    label={`Special (${categoryStats[BadgeCategory.SPECIAL]})`}
                    value={BadgeCategory.SPECIAL}
                />
            </Tabs>

            {earnedBadges.length > 0 && (
                <Box sx={{ mb: 4 }}>
                    <Typography variant="h6" sx={{ mb: 2 }}>
                        Earned Badges
                    </Typography>
                    <Box
                        sx={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
                            gap: 3,
                        }}
                    >
                        {earnedBadges.map((badge) => (
                            <Box
                                key={badge.id}
                                sx={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    gap: 1,
                                }}
                            >
                                <BadgeIcon badge={badge} size="large" />
                                <Typography variant="body2" sx={{ fontWeight: 'bold', textAlign: 'center' }}>
                                    {badge.name}
                                </Typography>
                                <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'center' }}>
                                    {format(new Date(badge.awardedAt), 'MMM dd, yyyy')}
                                </Typography>
                            </Box>
                        ))}
                    </Box>
                </Box>
            )}

            {lockedBadges.length > 0 && (
                <Box>
                    <Typography variant="h6" sx={{ mb: 2 }}>
                        Locked Badges
                    </Typography>
                    <Box
                        sx={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
                            gap: 3,
                        }}
                    >
                        {lockedBadges.map((badge) => (
                            <Box
                                key={badge.id}
                                sx={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    gap: 1,
                                }}
                            >
                                <BadgeIcon badge={badge} size="large" />
                                <Typography
                                    variant="body2"
                                    sx={{ fontWeight: 'bold', textAlign: 'center', color: '#999' }}
                                >
                                    {badge.name}
                                </Typography>
                                {badge.progress !== undefined && (
                                    <Box sx={{ width: '100%', px: 1 }}>
                                        <LinearProgress
                                            variant="determinate"
                                            value={badge.progress}
                                            sx={{ height: 4, borderRadius: 2 }}
                                        />
                                        <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
                                            {badge.progress}% Complete
                                        </Typography>
                                    </Box>
                                )}
                            </Box>
                        ))}
                    </Box>
                </Box>
            )}
        </Paper>
    );
}
