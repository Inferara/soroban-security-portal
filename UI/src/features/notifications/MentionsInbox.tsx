import { FC, useState, useEffect } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import Divider from '@mui/material/Divider';
import CircularProgress from '@mui/material/CircularProgress';
import { useNavigate } from 'react-router-dom';
import { Notification, NotificationType, NotificationEntityType } from '../../api/soroban-security-portal/models/notification';
import {
    getNotificationsCall,
    markNotificationReadCall,
} from '../../api/soroban-security-portal/soroban-security-portal-api';

const getEntityRoute = (n: Notification): string => {
    switch (n.entityType) {
        case NotificationEntityType.Vulnerability:
            return `/vulnerability/${n.entityId}`;
        case NotificationEntityType.Report:
            return `/report/${n.entityId}`;
        default:
            return '/';
    }
};

const formatTime = (createdAt: string): string => {
    const diff = Date.now() - new Date(createdAt).getTime();
    const minutes = Math.floor(diff / 60_000);
    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
};

export const MentionsInbox: FC = () => {
    const navigate = useNavigate();
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [loading, setLoading] = useState(false);
    const [page] = useState(1);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        getNotificationsCall(NotificationType.Mention, page)
            .then((items) => {
                if (!cancelled) setNotifications(items);
            })
            .catch((err) => {
                console.error('[MentionsInbox] fetch error:', err);
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [page]);

    const handleItemClick = async (n: Notification) => {
        await markNotificationReadCall(n.id);
        navigate(getEntityRoute(n));
    };

    return (
        <Box sx={{ p: 3, maxWidth: 700 }}>
            <Typography variant="h4" component="h2" sx={{ mb: 3, fontWeight: 700 }}>
                Mentions
            </Typography>

            {loading && (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                    <CircularProgress />
                </Box>
            )}

            {!loading && notifications.length === 0 && (
                <Typography variant="body1" color="text.secondary">
                    No mentions yet.
                </Typography>
            )}

            {!loading && notifications.length > 0 && (
                <List disablePadding>
                    {notifications.map((n, index) => (
                        <Box key={n.id}>
                            <ListItemButton
                                onClick={() => handleItemClick(n)}
                                sx={{
                                    backgroundColor: n.isRead ? 'inherit' : 'action.hover',
                                    borderRadius: 1,
                                    py: 1.5,
                                }}
                            >
                                <ListItemText
                                    primary={n.actorName}
                                    secondary={n.preview}
                                    slotProps={{
                                        primary: {
                                            sx: { fontWeight: n.isRead ? 400 : 600, fontSize: '1rem' },
                                        },
                                        secondary: {
                                            sx: { fontSize: '0.875rem' },
                                        },
                                    }}
                                />
                                <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap', ml: 2 }}>
                                    {formatTime(n.createdAt)}
                                </Typography>
                            </ListItemButton>
                            {index < notifications.length - 1 && <Divider />}
                        </Box>
                    ))}
                </List>
            )}
        </Box>
    );
};
