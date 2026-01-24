import { FC } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import Chip from '@mui/material/Chip';
import Link from '@mui/material/Link';
import { useTheme } from '@mui/material/styles';
import { Activity, ActivityType } from '../../../../api/soroban-security-portal/models/activity';
import { EntityAvatar, EntityType } from '../../../../components/EntityAvatar';
import ArticleIcon from '@mui/icons-material/Article';
import BugReportIcon from '@mui/icons-material/BugReport';
import CommentIcon from '@mui/icons-material/Comment';
import VerifiedIcon from '@mui/icons-material/Verified';
import { formatDistanceToNow } from 'date-fns';
import { NavLink } from 'react-router-dom';

interface ActivityCardProps {
    activity: Activity;
}

export const ActivityCard: FC<ActivityCardProps> = ({ activity }) => {
    const theme = useTheme();

    const getActivityIcon = () => {
        switch (activity.type) {
            case ActivityType.ReportCreated:
                return <ArticleIcon fontSize="small" color="primary" />;
            case ActivityType.ReportApproved:
                return <VerifiedIcon fontSize="small" color="success" />;
            case ActivityType.VulnerabilityCreated:
                return <BugReportIcon fontSize="small" color="error" />;
            case ActivityType.VulnerabilityApproved:
                return <VerifiedIcon fontSize="small" color="success" />;
            case ActivityType.CommentCreated:
                return <CommentIcon fontSize="small" color="info" />;
            default:
                return <ArticleIcon fontSize="small" />;
        }
    };

    const getActivityColor = () => {
        switch (activity.type) {
            case ActivityType.ReportCreated:
                return theme.palette.primary.main;
            case ActivityType.ReportApproved:
                return theme.palette.success.main;
            case ActivityType.VulnerabilityCreated:
                return theme.palette.error.main;
            case ActivityType.VulnerabilityApproved:
                return theme.palette.success.main;
            case ActivityType.CommentCreated:
                return theme.palette.info.main;
            default:
                return theme.palette.text.secondary;
        }
    };

    const getEntityForAvatar = (): { type: EntityType, id: number } => {
        if (activity.auditorId) return { type: 'auditor', id: activity.auditorId };
        if (activity.protocolId) return { type: 'protocol', id: activity.protocolId };
        if (activity.companyId) return { type: 'company', id: activity.companyId };
        return { type: 'user', id: activity.loginId || 0 };
    };

    const avatarEntity = getEntityForAvatar();
    const timeAgo = formatDistanceToNow(new Date(activity.createdAt), { addSuffix: true });

    // Determine what text to show
    const getActionText = () => {
        switch (activity.type) {
            case ActivityType.ReportCreated:
                return 'submitted a new report';
            case ActivityType.ReportApproved:
                return 'approved a report';
            case ActivityType.VulnerabilityCreated:
                return 'submitted a vulnerability';
            case ActivityType.VulnerabilityApproved:
                return 'approved a vulnerability';
            case ActivityType.CommentCreated:
                return 'commented on';
            default:
                return 'acted on';
        }
    };

    return (
        <Paper
            elevation={0}
            sx={{
                p: 2,
                mb: 2,
                borderRadius: 2,
                backgroundColor: 'background.paper',
                border: `1px solid ${theme.palette.divider}`,
                transition: 'transform 0.2s, box-shadow 0.2s',
                '&:hover': {
                    transform: 'translateY(-2px)',
                    boxShadow: theme.shadows[4],
                    borderColor: getActivityColor(),
                },
            }}
        >
            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
                <EntityAvatar
                    entityType={avatarEntity.type}
                    entityId={avatarEntity.id}
                    size="medium"
                    loadingStyle="fade"
                />

                <Box sx={{ flexGrow: 1 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 0.5 }}>
                        <Box>
                            <Typography variant="body2" component="span" fontWeight="bold">
                                {activity.actorName}
                            </Typography>
                            <Typography variant="body2" component="span" color="text.secondary" sx={{ mx: 0.5 }}>
                                {getActionText()}
                            </Typography>
                            <Link
                                component={NavLink}
                                to={activity.entityUrl}
                                color="inherit"
                                underline="hover"
                                fontWeight="medium"
                            >
                                {activity.entityTitle}
                            </Link>
                        </Box>
                        <Chip
                            icon={getActivityIcon()}
                            label={activity.typeLabel}
                            size="small"
                            variant="outlined"
                            sx={{ ml: 1, borderColor: 'transparent', backgroundColor: 'action.hover' }}
                        />
                    </Box>

                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
                        {activity.protocolName && (
                            <Chip
                                label={activity.protocolName}
                                size="small"
                                sx={{ fontSize: '0.7rem', height: 20 }}
                            />
                        )}
                        {activity.auditorName && (
                            <Chip
                                label={activity.auditorName}
                                size="small"
                                sx={{ fontSize: '0.7rem', height: 20 }}
                            />
                        )}

                        <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto' }}>
                            {timeAgo}
                        </Typography>
                    </Box>
                </Box>
            </Box>
        </Paper>
    );
};
