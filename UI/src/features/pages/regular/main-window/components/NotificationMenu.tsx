import { FC, useState, MouseEvent, useEffect } from 'react';
import {
    IconButton,
    Menu,
    MenuItem,
    ListItemText,
    ListItemIcon,
    Typography,
    Divider,
    Box,
    Tooltip,
    Badge,
    Button,
    Tabs,
    Tab,
    ListItemSecondaryAction
} from '@mui/material';
import NotificationsIcon from '@mui/icons-material/Notifications';
import ChatIcon from '@mui/icons-material/Chat';
import DoneAllIcon from '@mui/icons-material/DoneAll';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import { useNavigate } from 'react-router-dom';
import { Notification } from '../../../../../api/soroban-security-portal/models/thread';
import { getNotificationsCall, markNotificationAsReadCall, watchThreadCall } from '../../../../../api/soroban-security-portal/soroban-security-portal-api';
import { formatDateLong } from '../../../../../utils';

export const NotificationMenu: FC = () => {
    const navigate = useNavigate();
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [filter, setFilter] = useState('All');
    const [unreadCount, setUnreadCount] = useState(0);
    const open = Boolean(anchorEl);

    const fetchNotifications = async () => {
        try {
            const data = await getNotificationsCall();
            setNotifications(data);
            setUnreadCount(data.filter((n: Notification) => !n.isRead).length);
        } catch (error) {
            console.error('Failed to fetch notifications', error);
        }
    };

    useEffect(() => {
        void fetchNotifications();
        // Polling for new notifications every 30 seconds
        const interval = setInterval(() => {
            void fetchNotifications();
        }, 30000);
        return () => clearInterval(interval);
    }, []);

    const handleClick = (event: MouseEvent<HTMLElement>) => {
        setAnchorEl(event.currentTarget);
    };

    const handleClose = () => {
        setAnchorEl(null);
    };

    const handleNotificationClick = async (notification: Notification) => {
        if (!notification.isRead) {
            try {
                await markNotificationAsReadCall(notification.id);
                setNotifications(prev =>
                    prev.map(n => n.id === notification.id ? { ...n, isRead: true } : n)
                );
                setUnreadCount(prev => Math.max(0, prev - 1));
            } catch (error) {
                console.error('Failed to mark notification as read', error);
            }
        }

        // Navigate based on type (currently only 'NewReply' is supported)
        if (notification.link) {
            navigate(notification.link + (notification.type === 'Reply' ? '?tab=2' : ''));
        }
        handleClose();
    };

    const handleUnwatch = async (e: MouseEvent<HTMLButtonElement>, threadId: number) => {
        e.stopPropagation();
        try {
            await watchThreadCall(threadId, false);
            // Optionally remove those notifications or just show success
            // For now, just let the user know they unwatched
        } catch (error) {
            console.error('Failed to unwatch from notification', error);
        }
    };

    const handleMarkAllAsRead = async () => {
        const unreadIds = notifications.filter((n: Notification) => !n.isRead).map((n: Notification) => n.id);
        if (unreadIds.length === 0) return;

        try {
            await Promise.all(unreadIds.map(id => markNotificationAsReadCall(id)));
            setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
            setUnreadCount(0);
        } catch (error) {
            console.error('Failed to mark all as read', error);
        }
    };

    const filteredNotifications = filter === 'All'
        ? notifications
        : notifications.filter((n: Notification) => n.type === 'Reply');

    return (
        <>
            <Tooltip title="Notifications" arrow>
                <IconButton
                    color="inherit"
                    onClick={handleClick}
                    sx={{ ml: 1 }}
                    aria-label="notifications"
                >
                    <Badge badgeContent={unreadCount} color="error">
                        <NotificationsIcon />
                    </Badge>
                </IconButton>
            </Tooltip>
            <Menu
                anchorEl={anchorEl}
                open={open}
                onClose={handleClose}
                transformOrigin={{
                    vertical: 'top',
                    horizontal: 'right',
                }}
                anchorOrigin={{
                    vertical: 'bottom',
                    horizontal: 'right',
                }}
                disableScrollLock={true}
                slotProps={{
                    paper: {
                        sx: {
                            maxHeight: 520,
                            width: 380,
                            zIndex: 1200,
                            boxShadow: 3,
                            mt: 0.5,
                            display: 'flex',
                            flexDirection: 'column'
                        }
                    }
                }}
            >
                <Box sx={{ px: 2, py: 1.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="h6" fontWeight={600}>
                        Notifications
                    </Typography>
                    {unreadCount > 0 && (
                        <Button
                            size="small"
                            startIcon={<DoneAllIcon />}
                            onClick={handleMarkAllAsRead}
                            sx={{ textTransform: 'none' }}
                        >
                            Mark all read
                        </Button>
                    )}
                </Box>
                <Divider />

                <Tabs
                    value={filter}
                    onChange={(_, v: string) => setFilter(v)}
                    variant="fullWidth"
                    sx={{ borderBottom: 1, borderColor: 'divider', minHeight: 40 }}
                >
                    <Tab label="All" value="All" sx={{ minHeight: 40, py: 0 }} />
                    <Tab label="Watching" value="Watching" sx={{ minHeight: 40, py: 0 }} />
                </Tabs>

                <Box
                    sx={{
                        maxHeight: 380,
                        overflowY: 'auto',
                        '&::-webkit-scrollbar': { width: '6px' },
                        '&::-webkit-scrollbar-track': { backgroundColor: 'rgba(0,0,0,0.05)' },
                        '&::-webkit-scrollbar-thumb': { backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: '3px' },
                    }}
                >
                    {filteredNotifications.length === 0 ? (
                        <Box sx={{ py: 4, textAlign: 'center' }}>
                            <Typography variant="body2" color="text.secondary">
                                No {filter === 'Watching' ? 'watched threads' : 'notifications'} yet
                            </Typography>
                        </Box>
                    ) : (
                        filteredNotifications.map((notification: Notification) => (
                            <MenuItem
                                key={notification.id}
                                onClick={() => handleNotificationClick(notification)}
                                sx={{
                                    py: 1.5,
                                    pr: 6, // space for unwatch button
                                    borderLeft: notification.isRead ? 'none' : '4px solid',
                                    borderColor: 'primary.main',
                                    bgcolor: notification.isRead ? 'transparent' : 'action.hover',
                                    position: 'relative'
                                }}
                            >
                                <ListItemIcon>
                                    <ChatIcon color={notification.isRead ? 'disabled' : 'primary'} />
                                </ListItemIcon>
                                <ListItemText
                                    primary={notification.message}
                                    secondary={formatDateLong(notification.createdAt)}
                                    slotProps={{
                                        primary: {
                                            sx: {
                                                fontWeight: notification.isRead ? 400 : 600,
                                                fontSize: '0.9rem',
                                                lineHeight: 1.3,
                                                mb: 0.5
                                            }
                                        },
                                        secondary: {
                                            sx: { fontSize: '0.75rem' }
                                        }
                                    }}
                                />
                                {notification.type === 'Reply' && notification.threadId && (
                                    <ListItemSecondaryAction>
                                        <Tooltip title="Unwatch thread">
                                            <IconButton
                                                size="small"
                                                onClick={(e) => handleUnwatch(e, notification.threadId!)}
                                                sx={{ '&:hover': { color: 'error.main' } }}
                                            >
                                                <VisibilityOffIcon fontSize="small" />
                                            </IconButton>
                                        </Tooltip>
                                    </ListItemSecondaryAction>
                                )}
                            </MenuItem>
                        ))
                    )}
                </Box>
            </Menu>
        </>
    );
};
