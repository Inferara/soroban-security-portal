import React, { useState } from 'react';
import { Button, Paper, Typography, Box, Tabs, Tab, IconButton, List, ListItem, ListItemIcon, ListItemSecondaryAction, Chip, Stack, Tooltip } from '@mui/material';
import { useProfile } from './hooks';
import { styled } from '@mui/material/styles';
import { showError, showSuccess } from '../../../dialog-handler/dialog-handler';
import EditIcon from '@mui/icons-material/Edit';
import BookmarksIcon from '@mui/icons-material/Bookmarks';
import AssessmentIcon from '@mui/icons-material/Assessment';
import BugReportIcon from '@mui/icons-material/BugReport';
import DeleteIcon from '@mui/icons-material/Delete';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import GitHubIcon from '@mui/icons-material/GitHub';
import XIcon from '@mui/icons-material/X';
import ChatIcon from '@mui/icons-material/Chat';
import LanguageIcon from '@mui/icons-material/Language';
import LocalOfferIcon from '@mui/icons-material/LocalOffer';
import { MarkdownView } from '../../../../components/MarkdownView';
import { useNavigate } from 'react-router-dom';
import { useBookmarks } from '../../../../contexts/BookmarkContext';
import { BookmarkType } from '../../../../api/soroban-security-portal/models/bookmark';
import { StyledAvatar } from '../../../../components/common/StyledAvatar';
import { getUserInitials } from '../../../../utils/user-utils';
import { expertiseChipSx } from '../../../components/expertise-tags-input';

const ProfileContainer = styled(Box)(({ theme }) => ({
    minHeight: '100vh',
    padding: theme.spacing(3),
    maxWidth: '1400px',
    mx: 'auto',
}));

const ProfileHeader = styled(Box)(({ theme }) => ({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing(4),
    padding: theme.spacing(3, 0),
}));

const AvatarContainer = styled(Box)(() => ({
    display: 'flex',
    alignItems: 'center',
}));

const UserInfo = styled(Box)(() => ({
    display: 'flex',
    flexDirection: 'column',
}));

const UserName = styled(Typography)(({ theme }) => ({
    fontSize: '1.75rem',
    fontWeight: 600,
    marginBottom: theme.spacing(1),
}));

const UserDetails = styled(Typography)(({ theme }) => ({
    fontSize: '0.875rem',
    color: theme.palette.text.secondary,
    marginBottom: theme.spacing(0.5),
}));

const ContentSection = styled(Paper)(({ theme }) => ({
    borderRadius: theme.spacing(2),
    border: '1px solid',
    borderColor: theme.palette.divider,
    padding: theme.spacing(3),
    marginBottom: theme.spacing(3),
    boxShadow: 'none',
}));

const SectionTitle = styled(Typography)(({ theme }) => ({
    fontSize: '1.125rem',
    fontWeight: 600,
    marginBottom: theme.spacing(2),
}));

const PlaceholderText = styled(Typography)(({ theme }) => ({
    fontSize: '0.875rem',
    color: theme.palette.text.secondary,
    fontStyle: 'italic',
}));

const MarkdownContainer = styled(Paper)(({ theme }) => ({
    padding: theme.spacing(2),
    backgroundColor: theme.palette.mode === 'light' ? '#fafafa' : '#1a1a1a',
    border: '1px solid',
    borderColor: theme.palette.divider,
    borderRadius: theme.spacing(1),
    '& .markdown-content': {
        fontSize: '0.875rem',
        '& h1, & h2, & h3, & h4, & h5, & h6': {
            marginTop: theme.spacing(2),
            marginBottom: theme.spacing(1),
        },
        '& p': { marginBottom: theme.spacing(1) },
        '& ul, & ol': { marginBottom: theme.spacing(1), paddingLeft: theme.spacing(3) },
        '& li': { marginBottom: theme.spacing(0.5) },
        '& code': {
            backgroundColor: theme.palette.action.hover,
            padding: '2px 4px',
            borderRadius: '4px',
            fontSize: '0.8125rem',
        },
        '& pre': {
            backgroundColor: theme.palette.action.hover,
            padding: theme.spacing(1),
            borderRadius: '4px',
            overflow: 'auto',
        },
        '& blockquote': {
            borderLeft: `4px solid ${theme.palette.primary.main}`,
            paddingLeft: theme.spacing(2),
            marginLeft: 0,
            fontStyle: 'italic',
        },
        '& a': {
            color: theme.palette.primary.main,
            textDecoration: 'none',
            '&:hover': { textDecoration: 'underline' },
        },
    },
}));

interface TabPanelProps {
    children?: React.ReactNode;
    index: number;
    value: number;
}

function TabPanel(props: TabPanelProps) {
    const { children, value, index, ...other } = props;
    return (
        <div
            role="tabpanel"
            hidden={value !== index}
            id={`profile-tabpanel-${index}`}
            aria-labelledby={`profile-tab-${index}`}
            {...other}
        >
            {value === index && <Box sx={{ p: 0 }}>{children}</Box>}
        </div>
    );
}

function a11yProps(index: number) {
    return {
        id: `profile-tab-${index}`,
        'aria-controls': `profile-tabpanel-${index}`,
    };
}

export const Profile: React.FC = () => {
    const navigate = useNavigate();
    const [tabValue, setTabValue] = useState(0);

    const { user, userId } = useProfile();
    const { bookmarks, removeBookmark } = useBookmarks();

    const handleTabChange = (_: React.SyntheticEvent, newValue: number) => {
        setTabValue(newValue);
    };

    const handleBookmarkNavigate = (itemId: number, bookmarkType: BookmarkType) => {
        if (bookmarkType === BookmarkType.Report) {
            navigate(`/report/${itemId}`);
        } else if (bookmarkType === BookmarkType.Vulnerability) {
            navigate(`/vulnerability/${itemId}`);
        }
    };

    const handleRemoveBookmark = async (bookmarkId: number) => {
        const success = await removeBookmark(bookmarkId);
        if (success) {
            showSuccess('Bookmark removed successfully');
        } else {
            showError('Failed to remove bookmark');
        }
    };

    const getBookmarkIcon = (type: BookmarkType) => {
        switch (type) {
            case BookmarkType.Report:        return <AssessmentIcon />;
            case BookmarkType.Vulnerability: return <BugReportIcon />;
            default:                         return <BookmarksIcon />;
        }
    };

    // Social links from the flat fields on UserItem (via SelfEditUserItem)
    // Discord is rendered as non-clickable text — discord.com/users/ requires
    // a numeric ID, not a username, so we cannot construct a valid link.
    const clickableSocialLinks = [
        { key: 'github',  icon: <GitHubIcon fontSize="small" />,   label: 'GitHub',      url: user?.github },
        { key: 'twitter', icon: <XIcon fontSize="small" />,        label: 'Twitter / X', url: user?.twitter },
        { key: 'website', icon: <LanguageIcon fontSize="small" />, label: 'Website',     url: user?.website },
    ].filter((s) => s.url);

    const hasTags = (user?.expertiseTags?.length ?? 0) > 0;

    return (
        <ProfileContainer>
            <Box sx={{ margin: '0 auto' }}>
                {/* Profile Header */}
                <ProfileHeader>
                    <AvatarContainer>
                        <StyledAvatar size="large" sx={{ mr: 3 }}>
                            {user?.image ? (
                                <img
                                    src={`data:image/png;base64,${user.image}`}
                                    alt="User avatar"
                                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                />
                            ) : (
                                getUserInitials(user?.fullName || 'User Name')
                            )}
                        </StyledAvatar>
                        <UserInfo>
                            <UserName>{user?.fullName}</UserName>
                            <UserDetails>
                                Joined {user?.created ? new Date(user.created).toLocaleDateString() : ''}
                            </UserDetails>
                            <UserDetails>Role: {user?.role ?? 'user'}</UserDetails>

                            {/* Clickable social icons */}
                            {(clickableSocialLinks.length > 0 || user?.discord) && (
                                <Stack direction="row" spacing={0.5} mt={0.5}>
                                    {clickableSocialLinks.map((s) => (
                                        <Tooltip key={s.key} title={s.label} arrow>
                                            <IconButton
                                                component="a"
                                                href={s.url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                size="small"
                                                aria-label={s.label}
                                                sx={{
                                                    color: 'text.secondary',
                                                    '&:hover': { color: 'primary.main' },
                                                }}
                                            >
                                                {s.icon}
                                            </IconButton>
                                        </Tooltip>
                                    ))}
                                    {/* Discord: non-clickable, username shown in tooltip */}
                                    {user?.discord && (
                                        <Tooltip title={`Discord: ${user.discord}`} arrow>
                                            <Box
                                                sx={{
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    px: 0.5,
                                                    color: 'text.secondary',
                                                    cursor: 'default',
                                                }}
                                            >
                                                <ChatIcon fontSize="small" />
                                            </Box>
                                        </Tooltip>
                                    )}
                                </Stack>
                            )}
                        </UserInfo>
                    </AvatarContainer>

                    {userId == 0 && (
                        <Button
                            variant="contained"
                            startIcon={<EditIcon />}
                            onClick={() => navigate('/profile/edit')}
                        >
                            Edit Profile
                        </Button>
                    )}
                </ProfileHeader>

                {/* Tabs Navigation */}
                <Box sx={{ mb: 3, borderBottom: 1, borderColor: 'divider' }}>
                    <Tabs
                        value={tabValue}
                        onChange={handleTabChange}
                        aria-label="profile tabs"
                        sx={{
                            '& .MuiTab-root': {
                                textTransform: 'none',
                                fontSize: '1rem',
                                fontWeight: 600,
                                minHeight: 64,
                            },
                        }}
                    >
                        <Tab label="Profile" {...a11yProps(0)} />
                        <Tab label="Bookmarks" {...a11yProps(1)} />
                    </Tabs>
                </Box>

                <ContentSection>
                    <TabPanel value={tabValue} index={0}>

                        {/* Bio */}
                        {user?.bio && (
                            <Box sx={{ mb: 3 }}>
                                <SectionTitle>Bio</SectionTitle>
                                <MarkdownContainer>
                                    <MarkdownView content={user.bio} sx={{ p: 0 }} />
                                </MarkdownContainer>
                            </Box>
                        )}

                        {/* Expertise Tags */}
                        {hasTags && (
                            <Box sx={{ mb: 3 }}>
                                <Stack direction="row" alignItems="center" spacing={0.75} mb={1.5}>
                                    <LocalOfferIcon fontSize="small" color="action" />
                                    <SectionTitle sx={{ mb: 0 }}>Expertise</SectionTitle>
                                </Stack>
                                <Stack direction="row" flexWrap="wrap" gap={1}>
                                    {user!.expertiseTags.map((tag) => (
                                        <Chip
                                            key={tag}
                                            label={tag}
                                            size="small"
                                            sx={expertiseChipSx}
                                        />
                                    ))}
                                </Stack>
                            </Box>
                        )}

                        {/* Personal Information */}
                        <Box sx={{ mb: 3 }}>
                            <SectionTitle>Personal Information</SectionTitle>
                            {user?.personalInfo ? (
                                <MarkdownContainer>
                                    <MarkdownView content={user.personalInfo} sx={{ p: 0 }} />
                                </MarkdownContainer>
                            ) : (
                                <PlaceholderText>
                                    {userId == 0 ? 'Fill your info in Edit Profile page' : ''}
                                </PlaceholderText>
                            )}
                        </Box>

                        {/* Connected Accounts */}
                        <Box>
                            <SectionTitle>Connected accounts</SectionTitle>
                            <PlaceholderText>
                                {user?.connectedAccounts && user.connectedAccounts.length > 0
                                    ? user.connectedAccounts.map((account) => (
                                        <div key={account.serviceName}>
                                            {account.serviceName}: {account.accountId}
                                        </div>
                                    ))
                                    : (userId == 0 ? 'You can connect accounts in Edit Profile page' : '')}
                            </PlaceholderText>
                        </Box>
                    </TabPanel>

                    <TabPanel value={tabValue} index={1}>
                        <SectionTitle>My Bookmarks</SectionTitle>
                        {bookmarks.length === 0 ? (
                            <PlaceholderText>
                                No bookmarks yet. Bookmark reports and vulnerabilities to see them here.
                            </PlaceholderText>
                        ) : (
                            <List sx={{ width: '100%' }}>
                                {bookmarks.map((bookmark) => (
                                    <ListItem
                                        key={bookmark.id}
                                        sx={{
                                            border: '1px solid',
                                            borderColor: 'divider',
                                            borderRadius: 2,
                                            mb: 2,
                                            backgroundColor: 'background.paper',
                                            '&:hover': { backgroundColor: 'action.hover' },
                                        }}
                                    >
                                        <ListItemIcon sx={{ color: 'primary.main' }}>
                                            {getBookmarkIcon(bookmark.bookmarkType)}
                                        </ListItemIcon>
                                        <Box sx={{ flexGrow: 1, minWidth: 0, pr: 8 }}>
                                            <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 0.5 }}>
                                                {bookmark.title}
                                            </Typography>
                                            {bookmark.description && (
                                                <MarkdownView
                                                    content={
                                                        bookmark.description.length > 200
                                                            ? bookmark.description.substring(0, 200) + '...'
                                                            : bookmark.description
                                                    }
                                                    sx={{
                                                        p: 0,
                                                        '& .markdown-content': {
                                                            fontSize: '0.875rem',
                                                            color: 'text.secondary',
                                                            '& p': { margin: 0 },
                                                            '& h1, & h2, & h3, & h4, & h5, & h6': {
                                                                fontSize: '0.875rem',
                                                                fontWeight: 'normal',
                                                                margin: 0,
                                                            },
                                                            '& ul, & ol': { margin: 0, paddingLeft: 16 },
                                                            '& li': { margin: 0 },
                                                            '& code': { fontSize: '0.8125rem' },
                                                        },
                                                    }}
                                                />
                                            )}
                                        </Box>
                                        <ListItemSecondaryAction>
                                            <IconButton
                                                edge="end"
                                                onClick={() => handleBookmarkNavigate(bookmark.itemId, bookmark.bookmarkType)}
                                                sx={{ color: 'primary.main', mr: 1 }}
                                                title="Open"
                                            >
                                                <OpenInNewIcon />
                                            </IconButton>
                                            <IconButton
                                                edge="end"
                                                onClick={() => handleRemoveBookmark(bookmark.id)}
                                                sx={{ color: 'error.main' }}
                                                title="Remove bookmark"
                                            >
                                                <DeleteIcon />
                                            </IconButton>
                                        </ListItemSecondaryAction>
                                    </ListItem>
                                ))}
                            </List>
                        )}
                    </TabPanel>
                </ContentSection>
            </Box>
        </ProfileContainer>
    );
};