import { useState } from 'react';
import {
    Box, Container, Typography, Tab, Tabs,
    FormControl, InputLabel, Select, MenuItem, Paper,
    CircularProgress
} from '@mui/material';
import { useModerationQueue } from '../hooks/useModerationQueue';
import { ModerationStats } from '../components/ModerationStats';
import { ModerationItem } from '../components/ModerationItem';
import { ContentType, ModerationStatus } from '../types';

export const ModerationDashboard = () => {
    const { items, stats, loading, handleAction } = useModerationQueue();
    const [currentTab, setCurrentTab] = useState<ModerationStatus>('pending');
    const [contentTypeFilter, setContentTypeFilter] = useState<ContentType | 'all'>('all');

    if (loading || !stats) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 8 }}>
                <CircularProgress />
            </Box>
        );
    }

    const filteredItems = items.filter(item => {
        const statusMatch = item.status === currentTab;
        const typeMatch = contentTypeFilter === 'all' || item.contentType === contentTypeFilter;
        return statusMatch && typeMatch;
    });

    return (
        <Container maxWidth="lg" sx={{ py: 4 }}>
            <Box sx={{ mb: 4 }}>
                <Typography variant="h4" fontWeight="bold" gutterBottom>
                    Moderation Dashboard
                </Typography>
                <Typography variant="body1" color="text.secondary">
                    Review and moderate flagged content to keep the community safe.
                </Typography>
            </Box>

            <ModerationStats stats={stats} />

            <Paper sx={{ mb: 4 }}>
                <Box sx={{ borderBottom: 1, borderColor: 'divider', px: 2, pt: 2 }}>
                    <Tabs value={currentTab} onChange={(_, v) => setCurrentTab(v)}>
                        <Tab label="Pending Review" value="pending" />
                        <Tab label="History (Approved)" value="approved" />
                        <Tab label="History (Hidden)" value="hidden" />
                        <Tab label="History (Deleted)" value="deleted" />
                    </Tabs>
                </Box>

                <Box sx={{ p: 3 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 3 }}>
                        <FormControl size="small" sx={{ minWidth: 200 }}>
                            <InputLabel>Content Type</InputLabel>
                            <Select
                                value={contentTypeFilter}
                                label="Content Type"
                                onChange={(e) => setContentTypeFilter(e.target.value as any)}
                            >
                                <MenuItem value="all">All Content</MenuItem>
                                <MenuItem value="comment">Comments</MenuItem>
                                <MenuItem value="report">Reports</MenuItem>
                                <MenuItem value="user_profile">User Profiles</MenuItem>
                                <MenuItem value="vulnerability">Vulnerability</MenuItem>
                            </Select>
                        </FormControl>
                    </Box>

                    {filteredItems.length === 0 ? (
                        <Box sx={{ textAlign: 'center', py: 8 }}>
                            <Typography variant="h6" color="text.secondary">
                                No items found in this queue.
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                Great job! The community is safe.
                            </Typography>
                        </Box>
                    ) : (
                        filteredItems.map(item => (
                            <ModerationItem
                                key={item.id}
                                item={item}
                                onAction={handleAction}
                            />
                        ))
                    )}
                </Box>
            </Paper>
        </Container>
    );
};
