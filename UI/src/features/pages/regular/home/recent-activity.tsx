import { FC, useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Container from '@mui/material/Container';
import Grid from '@mui/material/Grid'; // v1 Grid for compatibility or update to Grid2 if preferred
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import { ActivityCard } from './activity-card';
import { Activity } from '../../../../api/soroban-security-portal/models/activity';
import { getRecentActivitiesCall, getPersonalizedActivitiesCall } from '../../../../api/soroban-security-portal/soroban-security-portal-api';
import { useAuth } from 'react-oidc-context';
import HistoryIcon from '@mui/icons-material/History';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Skeleton from '@mui/material/Skeleton';
import Alert from '@mui/material/Alert';

export const RecentActivity: FC = () => {
    const auth = useAuth();
    const [activities, setActivities] = useState<Activity[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [feedType, setFeedType] = useState<'all' | 'personalized'>('all');

    const fetchActivities = async () => {
        setLoading(true);
        setError(null);
        try {
            let data: Activity[] = [];
            if (auth.isAuthenticated && feedType === 'personalized') {
                data = await getPersonalizedActivitiesCall(24, 6);
            } else {
                data = await getRecentActivitiesCall(24, 6);
            }
            setActivities(data);
        } catch (err) {
            console.error('Failed to fetch activities:', err);
            setError('Failed to load recent activity.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchActivities();
    }, [auth.isAuthenticated, feedType]);

    const handleFeedTypeChange = (
        event: React.MouseEvent<HTMLElement>,
        newAlignment: 'all' | 'personalized' | null,
    ) => {
        if (newAlignment !== null) {
            setFeedType(newAlignment);
        }
    };

    return (
        <Container maxWidth="lg" sx={{ py: 8 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4, flexWrap: 'wrap', gap: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <HistoryIcon color="primary" fontSize="large" />
                    <Typography variant="h4" component="h2" fontWeight="bold">
                        Recent Activity
                    </Typography>
                </Box>

                <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                    {auth.isAuthenticated && (
                        <ToggleButtonGroup
                            value={feedType}
                            exclusive
                            onChange={handleFeedTypeChange}
                            aria-label="feed type"
                            size="small"
                            sx={{ mr: 2 }}
                        >
                            <ToggleButton value="all" aria-label="all activity">
                                All
                            </ToggleButton>
                            <ToggleButton value="personalized" aria-label="personalized">
                                Following
                            </ToggleButton>
                        </ToggleButtonGroup>
                    )}

                    <Button
                        variant="text"
                        endIcon={<ArrowForwardIcon />}
                        href="/activity"
                        sx={{ fontWeight: 'bold' }}
                    >
                        View All
                    </Button>
                </Box>
            </Box>

            {error ? (
                <Alert severity="error">{error}</Alert>
            ) : (
                <Grid container spacing={3}>
                    {loading ? (
                        Array.from(new Array(6)).map((_, index) => (
                            <Grid item xs={12} md={6} key={index}>
                                <Skeleton variant="rectangular" height={120} sx={{ borderRadius: 2 }} />
                            </Grid>
                        ))
                    ) : activities.length > 0 ? (
                        activities.map((activity) => (
                            <Grid item xs={12} md={6} key={activity.id}>
                                <ActivityCard activity={activity} />
                            </Grid>
                        ))
                    ) : (
                        <Grid item xs={12}>
                            <Box sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>
                                <Typography variant="body1">
                                    No recent activity found in the last 24 hours.
                                </Typography>
                            </Box>
                        </Grid>
                    )}
                </Grid>
            )}
        </Container>
    );
};
