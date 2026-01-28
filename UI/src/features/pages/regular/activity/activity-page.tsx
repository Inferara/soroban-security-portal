import { FC, useEffect, useState } from 'react';
import { Box, Container, Typography, Grid, ToggleButton, ToggleButtonGroup, Pagination, CircularProgress, Alert } from '@mui/material';
import { useAuth } from 'react-oidc-context';
import { Activity } from '../../../../api/soroban-security-portal/models/activity';
import { getRecentActivitiesCall, getPersonalizedActivitiesCall } from '../../../../api/soroban-security-portal/soroban-security-portal-api';
import { ActivityCard } from '../home/activity-card';
import HistoryIcon from '@mui/icons-material/History';

export const ActivityPage: FC = () => {
    const auth = useAuth();
    const [activities, setActivities] = useState<Activity[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [feedType, setFeedType] = useState<'all' | 'personalized'>('all');
    const [timeRange, setTimeRange] = useState<number>(24);
    const [page, setPage] = useState(1);
    const pageSize = 20;

    const fetchActivities = async () => {
        setLoading(true);
        setError(null);
        try {
            let data: Activity[] = [];
            const limit = pageSize;
            // Note: Backend doesn't support pagination yet beyond limit, so we fetch limit items
            // In a real implementation we'd add offset/page to backend

            if (auth.isAuthenticated && feedType === 'personalized') {
                data = await getPersonalizedActivitiesCall(timeRange, limit);
            } else {
                data = await getRecentActivitiesCall(timeRange, limit);
            }
            setActivities(data);
        } catch (err) {
            console.error('Failed to fetch activities:', err);
            setError('Failed to load activity feed.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchActivities();
    }, [auth.isAuthenticated, feedType, timeRange, page]);

    const handleFeedTypeChange = (
        event: React.MouseEvent<HTMLElement>,
        newAlignment: 'all' | 'personalized' | null,
    ) => {
        if (newAlignment !== null) {
            setFeedType(newAlignment);
        }
    };

    const handleTimeRangeChange = (
        event: React.MouseEvent<HTMLElement>,
        newRange: number | null,
    ) => {
        if (newRange !== null) {
            setTimeRange(newRange);
        }
    };

    return (
        <Container maxWidth="lg" sx={{ py: 4 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 4 }}>
                <HistoryIcon color="primary" fontSize="large" />
                <Typography variant="h3" component="h1" fontWeight="bold">
                    Community Activity
                </Typography>
            </Box>

            <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, justifyContent: 'space-between', mb: 4, gap: 2 }}>
                {auth.isAuthenticated && (
                    <Box>
                        <Typography variant="subtitle2" gutterBottom>View</Typography>
                        <ToggleButtonGroup
                            value={feedType}
                            exclusive
                            onChange={handleFeedTypeChange}
                            size="small"
                        >
                            <ToggleButton value="all">All Activity</ToggleButton>
                            <ToggleButton value="personalized">Following</ToggleButton>
                        </ToggleButtonGroup>
                    </Box>
                )}

                <Box>
                    <Typography variant="subtitle2" gutterBottom>Time Range</Typography>
                    <ToggleButtonGroup
                        value={timeRange}
                        exclusive
                        onChange={handleTimeRangeChange}
                        size="small"
                    >
                        <ToggleButton value={24}>Last 24h</ToggleButton>
                        <ToggleButton value={168}>Last 7 Days</ToggleButton>
                        <ToggleButton value={720}>Last 30 Days</ToggleButton>
                    </ToggleButtonGroup>
                </Box>
            </Box>

            {error && <Alert severity="error" sx={{ mb: 4 }}>{error}</Alert>}

            {loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
                    <CircularProgress />
                </Box>
            ) : activities.length > 0 ? (
                <Grid container spacing={2}>
                    {activities.map((activity) => (
                        <Grid item xs={12} key={activity.id}>
                            <ActivityCard activity={activity} />
                        </Grid>
                    ))}
                </Grid>
            ) : (
                <Box sx={{ textAlign: 'center', py: 8, color: 'text.secondary' }}>
                    <Typography variant="h6">No activity found</Typography>
                    <Typography variant="body2">Try adjusting the time range or filters.</Typography>
                </Box>
            )}

            {/* Pagination placeholder - needs backend support */}
            {/* <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
        <Pagination count={10} page={page} onChange={(_, p) => setPage(p)} color="primary" />
      </Box> */}
        </Container>
    );
};
