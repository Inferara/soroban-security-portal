import { Box, Paper, Grid, Typography, useTheme } from '@mui/material';
import { ModerationStats as StatsType } from '../types';
import { AssignmentTurnedIn, Flag, Delete, VisibilityOff } from '@mui/icons-material';

interface StatsProps {
    stats: StatsType;
}



const StatCard = ({ title, value, icon, color }: { title: string, value: number, icon: React.ReactNode, color: string }) => {
    const theme = useTheme();

    return (
        <Paper elevation={0} sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 2, border: `1px solid ${theme.palette.divider}` }}>
            <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: color + '20', color: color }}>
                {icon}
            </Box>
            <Box>
                <Typography variant="h4" fontWeight="bold">{value}</Typography>
                <Typography variant="body2" color="text.secondary">{title}</Typography>
            </Box>
        </Paper>
    );
};

export const ModerationStats = ({ stats }: StatsProps) => {
    const theme = useTheme();

    return (
        <Grid container spacing={3} sx={{ mb: 4 }}>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                <StatCard
                    title="Queue Size"
                    value={stats.queueSize}
                    icon={<Flag aria-label="Queue size indicator" />}
                    color={theme.palette.warning.main}
                />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                <StatCard
                    title="Actions Today"
                    value={stats.actionsToday}
                    icon={<AssignmentTurnedIn aria-label="Actions completed today" />}
                    color={theme.palette.primary.main}
                />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                <StatCard
                    title="Weekly Actions"
                    value={stats.actionsThisWeek}
                    icon={<VisibilityOff aria-label="Weekly moderation actions" />}
                    color={theme.palette.info.main}
                />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                <StatCard
                    title="Monthly Actions"
                    value={stats.actionsThisMonth}
                    icon={<Delete aria-label="Monthly moderation actions" />}
                    color={theme.palette.error.main}
                />
            </Grid>
        </Grid>
    );
};
