import { FC, useState, MouseEvent } from 'react';
import {
    IconButton,
    Menu,
    MenuItem,
    Typography,
    Divider,
    Box,
    Badge,
    Tooltip,
    Button,
    ListItemAvatar,
    Avatar
} from '@mui/material';
import NotificationsIcon from '@mui/icons-material/Notifications';
import InfoIcon from '@mui/icons-material/Info';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningIcon from '@mui/icons-material/Warning';
import ErrorIcon from '@mui/icons-material/Error';
import AssessmentIcon from '@mui/icons-material/Assessment';
import BugReportIcon from '@mui/icons-material/BugReport';
import CommentIcon from '@mui/icons-material/Comment';
import DoneAllIcon from '@mui/icons-material/DoneAll';
import SignalWifiStatusbarConnectedNoInternet4Icon from '@mui/icons-material/SignalWifiStatusbarConnectedNoInternet4';

import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { useNotifications } from '../../../../../hooks/useNotifications';
import { Notification, NotificationType } from '../../../../../api/soroban-security-portal/models/notification';

interface NotificationBellViewProps {
    notifications: Notification[];
    unreadCount: number;
    isConnected: boolean;
    onMarkAsRead: (id: string) => void;
    onMarkAllAsRead: () => Promise<void>;
    onViewAll: () => void;
    onNotificationClick: (notification: Notification) => void;
}

export const NotificationBellView: FC<NotificationBellViewProps> = ({
    notifications,
    unreadCount,
    isConnected,
    onMarkAllAsRead,
    onViewAll,
    onNotificationClick
}) => {
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
    const open = Boolean(anchorEl);

    const handleClick = (event: MouseEvent<HTMLElement>) => {
        setAnchorEl(event.currentTarget);
    };

    const handleClose = () => {
        setAnchorEl(null);
    };

    const handleNotificationClickInternal = (notification: Notification) => {
        onNotificationClick(notification);
        handleClose();
    };

    const handleMarkAllAsReadInternal = async (event: MouseEvent) => {
        event.stopPropagation();
        await onMarkAllAsRead();
    };

    const handleViewAllInternal = () => {
        onViewAll();
        handleClose();
    };

    const getNotificationIcon = (type: NotificationType) => {
        switch (type) {
            case NotificationType.Info: return <InfoIcon fontSize="small" color="info" />;
            case NotificationType.Success: return <CheckCircleIcon fontSize="small" color="success" />;
            case NotificationType.Warning: return <WarningIcon fontSize="small" color="warning" />;
            case NotificationType.Error: return <ErrorIcon fontSize="small" color="error" />;
            case NotificationType.Report: return <AssessmentIcon fontSize="small" color="primary" />;
            case NotificationType.Vulnerability: return <BugReportIcon fontSize="small" color="error" />;
            case NotificationType.Comment: return <CommentIcon fontSize="small" color="action" />;
            default: return <NotificationsIcon fontSize="small" />;
        }
    };

    return (
        <>
            <Tooltip title={isConnected ? "Notifications" : "Connecting to notifications..."} arrow>
                <IconButton
                    color="inherit"
                    onClick={handleClick}
                    aria-label="notifications"
                    sx={{ ml: 1 }}
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
                transformOrigin={{ vertical: 'top', horizontal: 'right' }}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                disableScrollLock={true}
                slotProps={{
                    paper: {
                        sx: {
                            width: 360,
                            maxHeight: 500,
                            overflow: 'hidden',
                            display: 'flex',
                            flexDirection: 'column',
                            mt: 1.5,
                            boxShadow: 4
                        }
                    }
                }}
            >
                <Box sx={{ p: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="h6" fontWeight={700}>
                            Notifications
                        </Typography>
                        {!isConnected && (
                            <Tooltip title="Disconnected">
                                <SignalWifiStatusbarConnectedNoInternet4Icon fontSize="small" color="disabled" />
                            </Tooltip>
                        )}
                    </Box>
                    {unreadCount > 0 && (
                        <Tooltip title="Mark all as read">
                            <IconButton size="small" onClick={handleMarkAllAsReadInternal} color="primary">
                                <DoneAllIcon fontSize="small" />
                            </IconButton>
                        </Tooltip>
                    )}
                </Box>
                <Divider />

                <Box sx={{ overflowY: 'auto', flexGrow: 1, maxHeight: 400 }}>
                    {notifications.length === 0 ? (
                        <Box sx={{ p: 3, textAlign: 'center' }}>
                            <Typography variant="body2" color="text.secondary">
                                No notifications yet
                            </Typography>
                        </Box>
                    ) : (
                        notifications.slice(0, 10).map((notification) => (
                            <MenuItem
                                key={notification.id}
                                onClick={() => handleNotificationClickInternal(notification)}
                                sx={{
                                    py: 1.5,
                                    px: 2,
                                    bgcolor: notification.isRead ? 'transparent' : 'action.hover',
                                    borderBottom: '1px solid',
                                    borderColor: 'divider',
                                    alignItems: 'flex-start',
                                    gap: 1.5,
                                    whiteSpace: 'normal'
                                }}
                            >
                                <ListItemAvatar sx={{ minWidth: 40, mt: 0.5 }}>
                                    {notification.actorAvatarUrl ? (
                                        <Avatar
                                            src={notification.actorAvatarUrl}
                                            alt={notification.actorName}
                                            sx={{ width: 40, height: 40 }}
                                        />
                                    ) : (
                                        <Avatar sx={{ width: 40, height: 40, bgcolor: 'background.default' }}>
                                            {getNotificationIcon(notification.type)}
                                        </Avatar>
                                    )}
                                </ListItemAvatar>

                                <Box sx={{ flex: 1, minWidth: 0 }}>
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 0.5 }}>
                                        <Typography variant="subtitle2" fontWeight={notification.isRead ? 500 : 700} lineHeight={1.2}>
                                            {notification.title}
                                        </Typography>
                                        <Typography variant="caption" color="text.secondary" sx={{ ml: 1, whiteSpace: 'nowrap' }}>
                                            {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                                        </Typography>
                                    </Box>
                                    <Typography variant="body2" color="text.secondary" sx={{
                                        display: '-webkit-box',
                                        overflow: 'hidden',
                                        WebkitBoxOrient: 'vertical',
                                        WebkitLineClamp: 2
                                    }}>
                                        {notification.message}
                                    </Typography>
                                </Box>
                                {!notification.isRead && (
                                    <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: 'primary.main', alignSelf: 'center', flexShrink: 0 }} />
                                )}
                            </MenuItem>
                        ))
                    )}
                </Box>

                <Divider />
                <Button
                    fullWidth
                    onClick={handleViewAllInternal}
                    sx={{ p: 1.5, borderRadius: 0 }}
                >
                    View All Notifications
                </Button>
            </Menu>
        </>
    );
};

export const NotificationBell: FC = () => {
    const navigate = useNavigate();
    const { notifications, unreadCount, markAsRead, markAllAsRead, isConnected } = useNotifications();

    const handleNotificationClick = async (notification: Notification) => {
        if (!notification.isRead) {
            markAsRead(notification.id);
        }
        if (notification.link) {
            navigate(notification.link);
        }
    };

    const handleViewAll = () => {
        navigate('/notifications');
    };

    return (
        <NotificationBellView
            notifications={notifications}
            unreadCount={unreadCount}
            isConnected={isConnected}
            onMarkAsRead={markAsRead}
            onMarkAllAsRead={markAllAsRead}
            onViewAll={handleViewAll}
            onNotificationClick={handleNotificationClick}
        />
    );
};
