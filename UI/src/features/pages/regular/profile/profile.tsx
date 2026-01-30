import React, { useState } from 'react';
import { Button, Paper, Typography, Box, Tabs, Tab, IconButton, List, ListItem, ListItemIcon, ListItemSecondaryAction } from '@mui/material';
import { useProfile } from './hooks';
import { styled } from '@mui/material/styles';
import { showError, showSuccess } from '../../../dialog-handler/dialog-handler';
// import LockIcon from '@mui/icons-material/Lock'; // For password change section (commented out)
import EditIcon from '@mui/icons-material/Edit';
import BookmarksIcon from '@mui/icons-material/Bookmarks';
import AssessmentIcon from '@mui/icons-material/Assessment';
import BugReportIcon from '@mui/icons-material/BugReport';
import DeleteIcon from '@mui/icons-material/Delete';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import ChatIcon from '@mui/icons-material/Chat';
import { MarkdownView } from '../../../../components/MarkdownView';
import { useNavigate } from 'react-router-dom';
import { useBookmarks } from '../../../../contexts/BookmarkContext';
import { BookmarkType } from '../../../../api/soroban-security-portal/models/bookmark';
import { StyledAvatar } from '../../../../components/common/StyledAvatar';
import { getUserInitials } from '../../../../utils/user-utils';
import { formatDateLong } from '../../../../utils';

const ProfileContainer = styled(Box)(({ theme }) => ({
  minHeight: '100vh',
  padding: theme.spacing(3),
  maxWidth: '1400px',
  mx: 'auto'
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

// Using shared StyledAvatar from components/common/StyledAvatar.tsx

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
    '& p': {
      marginBottom: theme.spacing(1),
    },
    '& ul, & ol': {
      marginBottom: theme.spacing(1),
      paddingLeft: theme.spacing(3),
    },
    '& li': {
      marginBottom: theme.spacing(0.5),
    },
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
      '&:hover': {
        textDecoration: 'underline',
      },
    },
  }
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
      {value === index && (
        <Box sx={{ p: 0 }}>
          {children}
        </Box>
      )}
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

  const {
    user,
    userId,
    watchedThreads,
    threadsLoading,
    toggleWatch
  } = useProfile();

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
      case BookmarkType.Report:
        return <AssessmentIcon />;
      case BookmarkType.Vulnerability:
        return <BugReportIcon />;
      default:
        return <BookmarksIcon />;
    }
  };

  // Using shared getUserInitials from utils/user-utils.ts

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
              <UserName>
                {user?.fullName}
              </UserName>
              <UserDetails>
                Joined {user?.created ? new Date(user.created).toLocaleDateString() : ''}
              </UserDetails>
              <UserDetails>
                Role: {user?.role ?? 'user'}
              </UserDetails>
            </UserInfo>
          </AvatarContainer>
          {
            userId == 0 && (
              <Button
                variant="contained"
                startIcon={<EditIcon />}
                onClick={() => {
                  navigate('/profile/edit');
                }}
              >
                Edit Profile
              </Button>
            )
          }
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
                minHeight: 64
              }
            }}
          >
            <Tab label="Profile" {...a11yProps(0)} />
            <Tab label="Bookmarks" {...a11yProps(1)} />
            <Tab label="Watched Threads" {...a11yProps(2)} />
          </Tabs>
        </Box>

        {/* Tab Panels */}
        <ContentSection>
          <TabPanel value={tabValue} index={0}>
            {/* Personal Information */}
            <Box sx={{ mb: 3 }}>
              <SectionTitle>
                Personal Information
              </SectionTitle>
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
              <SectionTitle>
                Connected accounts
              </SectionTitle>
              <PlaceholderText>
                {user?.connectedAccounts && user?.connectedAccounts.length > 0 ? user?.connectedAccounts.map(account => (
                  <div key={account.serviceName}>
                    {account.serviceName}: {account.accountId}
                  </div>
                )) : (userId == 0 ? 'You can connect accounts in Edit Profile page' : '')}
              </PlaceholderText>
            </Box>
          </TabPanel>

          <TabPanel value={tabValue} index={1}>
            {/* Bookmarks */}
            <SectionTitle>
              My Bookmarks
            </SectionTitle>
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
                      '&:hover': {
                        backgroundColor: 'action.hover',
                      },
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
                          content={bookmark.description.length > 200
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
                                margin: 0
                              },
                              '& ul, & ol': {
                                margin: 0,
                                paddingLeft: 16
                              },
                              '& li': { margin: 0 },
                              '& code': {
                                fontSize: '0.8125rem'
                              }
                            }
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

          <TabPanel value={tabValue} index={2}>
            {/* Watched Threads */}
            <SectionTitle>
              Watched Threads
            </SectionTitle>
            {watchedThreads.length === 0 ? (
              <PlaceholderText>
                You are not watching any threads yet. Threads you reply to or manually watch will appear here.
              </PlaceholderText>
            ) : (
              <List sx={{ width: '100%' }}>
                {watchedThreads.map((thread) => (
                  <ListItem
                    key={thread.id}
                    sx={{
                      border: '1px solid',
                      borderColor: 'divider',
                      borderRadius: 2,
                      mb: 2,
                      backgroundColor: 'background.paper',
                      '&:hover': {
                        backgroundColor: 'action.hover',
                      },
                    }}
                  >
                    <ListItemIcon sx={{ color: 'secondary.main' }}>
                      <ChatIcon />
                    </ListItemIcon>
                    <Box sx={{ flexGrow: 1, minWidth: 0, pr: 8 }}>
                      <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 0.5 }}>
                        Discussion on Vulnerability #{thread.vulnerabilityId}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {thread.replies.length} replies • Last activity {thread.replies.length > 0 ? formatDateLong(thread.replies[thread.replies.length - 1].createdAt) : formatDateLong(thread.createdAt)}
                      </Typography>
                    </Box>
                    <ListItemSecondaryAction>
                      <IconButton
                        edge="end"
                        onClick={() => navigate(`/vulnerability/${thread.vulnerabilityId}?tab=2`)}
                        sx={{ color: 'primary.main', mr: 1 }}
                        title="Open Thread"
                      >
                        <OpenInNewIcon />
                      </IconButton>
                      <IconButton
                        edge="end"
                        onClick={() => toggleWatch(thread.id, false)}
                        sx={{ color: 'secondary.main' }}
                        title="Unwatch Thread"
                      >
                        <VisibilityOffIcon />
                      </IconButton>
                    </ListItemSecondaryAction>
                  </ListItem>
                ))}
              </List>
            )}
          </TabPanel>
        </ContentSection>

        {/* Password Change Section - Hidden by default, can be shown in Edit Profile
        {user?.loginType === "Password" && (
          <ContentSection>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <LockIcon sx={{ mr: 1, color: '#3B82F6' }} />
              <SectionTitle sx={{ mb: 0 }}>
                Change Password
              </SectionTitle>
            </Box>
            <Grid container spacing={2}>
              <Grid size={12}>
                <TextField 
                  fullWidth
                  id="old-password" 
                  label="Current Password" 
                  autoComplete="current-password"
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  type="password"
                  size="small"
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      backgroundColor: '#374151',
                      '& fieldset': {
                        borderColor: '#6B7280',
                      },
                      '&:hover fieldset': {
                        borderColor: '#9CA3AF',
                      },
                      '&.Mui-focused fieldset': {
                        borderColor: '#3B82F6',
                      },
                    },
                    '& .MuiInputLabel-root': {
                      color: '#9CA3AF',
                    },
                    '& .MuiInputBase-input': {
                      color: '#ffffff',
                    },
                  }}
                />
              </Grid>
              <Grid size={12}>
                <TextField 
                  fullWidth
                  id="new-password" 
                  label="New Password" 
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  type="password"
                  size="small"
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      backgroundColor: '#374151',
                      '& fieldset': {
                        borderColor: '#6B7280',
                      },
                      '&:hover fieldset': {
                        borderColor: '#9CA3AF',
                      },
                      '&.Mui-focused fieldset': {
                        borderColor: '#3B82F6',
                      },
                    },
                    '& .MuiInputLabel-root': {
                      color: '#9CA3AF',
                    },
                    '& .MuiInputBase-input': {
                      color: '#ffffff',
                    },
                  }}
                />
              </Grid>
              <Grid size={12}>
                <TextField 
                  fullWidth
                  id="confirm-password" 
                  label="Confirm New Password" 
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  type="password"
                  size="small"
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      backgroundColor: '#374151',
                      '& fieldset': {
                        borderColor: '#6B7280',
                      },
                      '&:hover fieldset': {
                        borderColor: '#9CA3AF',
                      },
                      '&.Mui-focused fieldset': {
                        borderColor: '#3B82F6',
                      },
                    },
                    '& .MuiInputLabel-root': {
                      color: '#9CA3AF',
                    },
                    '& .MuiInputBase-input': {
                      color: '#ffffff',
                    },
                  }}
                />
              </Grid>
              <Grid size={12}>
                <Button 
                  variant="contained" 
                  onClick={handleChangePassword}
                >
                  Update Password
                </Button>
              </Grid>
            </Grid>
          </ContentSection>
        )}
        */}
      </Box>
    </ProfileContainer>
  );
} 