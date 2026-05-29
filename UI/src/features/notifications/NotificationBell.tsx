import { FC, useState, MouseEvent } from 'react';
import {
    IconButton,
    Menu,
    MenuItem,
    ListItemText,
    Typography,
    Divider,
    Box,
    Badge,
    Tooltip,
} from '@mui/material';
import NotificationsIcon from '@mui/icons-material/Notifications';
import { useNavigate } from 'react-router-dom';
import { useNotifications } from './useNotifications';
import { Notification, NotificationEntityType } from '../../api/soroban-security-portal/models/notification';

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

export const NotificationBell: FC = () => {
    const navigate = useNavigate();
    const { notifications, unreadCount, markRead, markAllRead } = useNotifications();
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
    const open = Boolean(anchorEl);

    const handleClick = (event: MouseEvent<HTMLElement>) => {
        setAnchorEl(event.currentTarget);
    };

    const handleClose = () => {
        setAnchorEl(null);
    };

    const handleNotificationClick = (n: Notification) => {
        markRead(n.id);
        handleClose();
        navigate(getEntityRoute(n));
    };

    const handleMarkAllRead = () => {
        markAllRead();
    };

    const handleViewAll = () => {
        handleClose();
        navigate('/mentions');
    };

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
                disableAutoFocus={true}
                disableEnforceFocus={true}
                slotProps={{
                    paper: {
                        sx: {
                            maxHeight: 440,
                            width: 360,
                            overflowY: 'auto',
                            zIndex: 1200,
                            boxShadow: 3,
                            mt: 0.5,
                        },
                    },
                    root: {
                        sx: {
                            '& .MuiBackdrop-root': {
                                backgroundColor: 'transparent',
                            },
                        },
                    },
                }}
            >
                {/* Header row */}
                <Box sx={{ px: 2, py: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Typography variant="h6" sx={{ fontWeight: 600 }}>
                        Notifications
                    </Typography>
                    {notifications.length > 0 && (
                        <Typography
                            variant="body2"
                            sx={{ cursor: 'pointer', color: 'primary.main' }}
                            onClick={handleMarkAllRead}
                        >
                            Mark all read
                        </Typography>
                    )}
                </Box>
                <Divider />

                {/* Notification list */}
                <Box
                    sx={{
                        maxHeight: 320,
                        overflowY: 'auto',
                        '&::-webkit-scrollbar': { width: '6px' },
                        '&::-webkit-scrollbar-track': { backgroundColor: 'rgba(0,0,0,0.1)', borderRadius: '3px' },
                        '&::-webkit-scrollbar-thumb': {
                            backgroundColor: 'rgba(0,0,0,0.3)',
                            borderRadius: '3px',
                            '&:hover': { backgroundColor: 'rgba(0,0,0,0.5)' },
                        },
                    }}
                >
                    {notifications.length === 0 ? (
                        <MenuItem disabled>
                            <ListItemText
                                primary="No notifications"
                                secondary="You're all caught up"
                            />
                        </MenuItem>
                    ) : (
                        notifications.map((n) => (
                            <MenuItem
                                key={n.id}
                                onClick={() => handleNotificationClick(n)}
                                sx={{
                                    backgroundColor: n.isRead ? 'inherit' : 'action.hover',
                                    alignItems: 'flex-start',
                                    gap: 1,
                                }}
                            >
                                <ListItemText
                                    primary={n.actorName}
                                    secondary={n.preview}
                                    slotProps={{
                                        primary: { noWrap: true, sx: { fontWeight: n.isRead ? 400 : 600 } },
                                        secondary: { noWrap: true, sx: { fontSize: '0.75rem' } },
                                    }}
                                />
                                <Typography variant="caption" sx={{ whiteSpace: 'nowrap', mt: 0.5, color: 'text.secondary' }}>
                                    {formatTime(n.createdAt)}
                                </Typography>
                            </MenuItem>
                        ))
                    )}
                </Box>

                {/* Footer */}
                <Divider />
                <MenuItem onClick={handleViewAll} sx={{ justifyContent: 'center' }}>
                    <Typography variant="body2" sx={{ color: 'primary.main', fontWeight: 500 }}>
                        View all
                    </Typography>
                </MenuItem>
            </Menu>
        </>
    );
};
