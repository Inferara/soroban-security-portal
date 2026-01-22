import { Box, Container, Typography, Paper, Divider } from '@mui/material';
import { UserBadges } from '../components/UserBadges';
import { BadgeShowcase } from '../components/BadgeShowcase';
import { MOCK_BADGES } from '../utils/mockBadges';

export function BadgeDemoPage() {
    const earnedBadges = MOCK_BADGES.filter((b) => !b.isLocked);
    const top3Badges = earnedBadges.slice(0, 3);

    return (
        <Container maxWidth="lg" sx={{ py: 4 }}>
            <Typography variant="h3" sx={{ mb: 4, fontWeight: 'bold' }}>
                Badge System Demo
            </Typography>

            <Paper sx={{ p: 3, mb: 4 }}>
                <Typography variant="h5" sx={{ mb: 2 }}>
                    Comment Badge Display (Top 3)
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    This shows how badges appear next to usernames in comments
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
                        John Doe
                    </Typography>
                    <UserBadges badges={top3Badges} mode="compact" maxBadges={3} size="small" />
                </Box>
            </Paper>

            <Divider sx={{ my: 4 }} />

            <Typography variant="h5" sx={{ mb: 3 }}>
                Full Badge Showcase (Profile Page)
            </Typography>
            <BadgeShowcase badges={MOCK_BADGES} />
        </Container>
    );
}
