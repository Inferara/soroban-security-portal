import React, { useState, useEffect } from 'react';
import { Button, Paper, Typography, Box, Tabs, Tab, CircularProgress, Stack, Divider, List, ListItem, ListItemText, Alert } from '@mui/material';
import { useUserProfile } from './hooks';
import { styled } from '@mui/material/styles';
import EditIcon from '@mui/icons-material/Edit';
import { MarkdownView } from '../../../../components/MarkdownView';
import { useNavigate } from 'react-router-dom';
import { StyledAvatar } from '../../../../components/common/StyledAvatar';
import { getUserInitials } from '../../../../utils/user-utils';
import { ExpertiseTags } from './components/ExpertiseTags';
import { SocialLinks } from './components/SocialLinks';
import { ReputationBadge } from './components/ReputationBadge';
import { UserBadges } from './components/UserBadges';
import { FollowButton } from './components/FollowButton';
import { useAuth } from 'react-oidc-context';
import PeopleIcon from '@mui/icons-material/People';
import AssessmentIcon from '@mui/icons-material/Assessment';
import CommentIcon from '@mui/icons-material/Comment';
import BookmarksIcon from '@mui/icons-material/Bookmarks';
import TimelineIcon from '@mui/icons-material/Timeline';
import LockIcon from '@mui/icons-material/Lock';

const ProfileContainer = styled(Box)(({ theme }) => ({
  minHeight: '100vh',
  padding: theme.spacing(3),
  maxWidth: '1400px',
  mx: 'auto'
}));

const ProfileHeader = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  marginBottom: theme.spacing(4),
  padding: theme.spacing(3, 0),
  gap: theme.spacing(3),
  [theme.breakpoints.down('md')]: {
    flexDirection: 'column',
    alignItems: 'stretch',
  }
}));

const AvatarSection = styled(Box)(() => ({
  display: 'flex',
  alignItems: 'flex-start',
  gap: 24,
  flex: 1,
}));

const UserInfo = styled(Box)(() => ({
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
  flex: 1,
}));

const UserName = styled(Typography)(({ theme }) => ({
  fontSize: '1.75rem',
  fontWeight: 600,
  marginBottom: theme.spacing(0.5),
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

const StatBox = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  padding: theme.spacing(1.5),
  borderRadius: theme.spacing(1),
  backgroundColor: theme.palette.action.hover,
  minWidth: 80,
}));

const StatValue = styled(Typography)(({ theme }) => ({
  fontSize: '1.5rem',
  fontWeight: 700,
  color: theme.palette.primary.main,
}));

const StatLabel = styled(Typography)(({ theme }) => ({
  fontSize: '0.75rem',
  color: theme.palette.text.secondary,
  textTransform: 'uppercase',
  fontWeight: 500,
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

export const UserProfile: React.FC = () => {
  const navigate = useNavigate();
  const auth = useAuth();
  const [tabValue, setTabValue] = useState(0);

  const {
    user,
    activity,
    loading,
    isFollowing,
    followLoading,
    handleFollow,
    isOwnProfile,
  } = useUserProfile();

  useEffect(() => {
    if (user) {
      // Update page title for SEO
      document.title = `${user.fullName} - Soroban Security Portal`;
      
      // Update meta description
      const metaDescription = document.querySelector('meta[name="description"]');
      if (metaDescription) {
        metaDescription.setAttribute('content', user.bio || `View ${user.fullName}'s profile on Soroban Security Portal`);
      }
    }
  }, [user]);

  const handleTabChange = (_: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!user) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">User not found</Alert>
      </Box>
    );
  }

  // Handle private profiles
  if (!user.isPublic && !isOwnProfile) {
    return (
      <ProfileContainer>
        <ContentSection>
          <Box sx={{ textAlign: 'center', py: 6 }}>
            <LockIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h5" gutterBottom>
              This Profile is Private
            </Typography>
            <Typography variant="body1" color="text.secondary">
              {user.fullName} has set their profile to private.
            </Typography>
          </Box>
        </ContentSection>
      </ProfileContainer>
    );
  }

  return (
    <ProfileContainer>
      <Box sx={{ margin: '0 auto' }}>
        {/* Profile Header */}
        <ProfileHeader>
          <AvatarSection>
            <StyledAvatar size="large" sx={{ width: 120, height: 120, fontSize: '2.5rem' }}>
              {user?.image ? (
                <img
                  src={`data:image/png;base64,${user.image}`}
                  alt={`${user.fullName}'s avatar`}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              ) : (
                getUserInitials(user?.fullName || 'User Name')
              )}
            </StyledAvatar>
            <UserInfo>
              <Box>
                <UserName>
                  {user?.fullName}
                </UserName>
                {user.role && (
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    {user.role}
                  </Typography>
                )}
                {user.bio && (
                  <Typography variant="body1" sx={{ mb: 2, maxWidth: 600 }}>
                    {user.bio}
                  </Typography>
                )}
              </Box>

              {/* Expertise Tags */}
              {user.expertiseTags && user.expertiseTags.length > 0 && (
                <Box sx={{ mb: 2 }}>
                  <ExpertiseTags tags={user.expertiseTags} />
                </Box>
              )}

              {/* Social Links and Stats Row */}
              <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap" useFlexGap>
                {user.socialLinks && <SocialLinks links={user.socialLinks} />}
                
                <Divider orientation="vertical" flexItem />
                
                <UserDetails>
                  Joined {user?.created ? new Date(user.created).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : ''}
                </UserDetails>
              </Stack>

              {/* Reputation and Badges */}
              <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap" useFlexGap sx={{ mt: 1 }}>
                {user.reputationScore !== undefined && (
                  <ReputationBadge score={user.reputationScore} />
                )}
                {user.badges && user.badges.length > 0 && (
                  <UserBadges badges={user.badges} />
                )}
              </Stack>
            </UserInfo>
          </AvatarSection>

          {/* Action Buttons */}
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
            {/* Stats */}
            <Stack direction="row" spacing={2}>
              <StatBox>
                <StatValue>{user.followersCount || 0}</StatValue>
                <StatLabel>Followers</StatLabel>
              </StatBox>
              <StatBox>
                <StatValue>{user.followingCount || 0}</StatValue>
                <StatLabel>Following</StatLabel>
              </StatBox>
            </Stack>

            {/* Follow/Edit Button */}
            {isOwnProfile ? (
              <Button
                variant="contained"
                startIcon={<EditIcon />}
                onClick={() => navigate('/profile/edit')}
                sx={{ minWidth: 120 }}
              >
                Edit Profile
              </Button>
            ) : auth.isAuthenticated ? (
              <FollowButton
                isFollowing={isFollowing}
                loading={followLoading}
                onClick={handleFollow}
              />
            ) : null}
          </Box>
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
            <Tab icon={<TimelineIcon />} iconPosition="start" label="Activity" {...a11yProps(0)} />
            <Tab icon={<AssessmentIcon />} iconPosition="start" label="Reports" {...a11yProps(1)} />
            <Tab icon={<CommentIcon />} iconPosition="start" label="Comments" {...a11yProps(2)} />
            {(user.isPublic || isOwnProfile) && (
              <Tab icon={<BookmarksIcon />} iconPosition="start" label="Bookmarks" {...a11yProps(3)} />
            )}
          </Tabs>
        </Box>

        {/* Tab Panels */}
        <ContentSection>
          <TabPanel value={tabValue} index={0}>
            {/* Activity Tab */}
            <SectionTitle>Recent Activity</SectionTitle>
            {activity.length === 0 ? (
              <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                No recent activity
              </Typography>
            ) : (
              <List sx={{ width: '100%' }}>
                {activity.map((item) => (
                  <ListItem
                    key={item.id}
                    sx={{
                      border: '1px solid',
                      borderColor: 'divider',
                      borderRadius: 2,
                      mb: 2,
                      backgroundColor: 'background.paper',
                      cursor: item.link ? 'pointer' : 'default',
                      '&:hover': item.link ? {
                        backgroundColor: 'action.hover',
                      } : {},
                    }}
                    onClick={() => item.link && navigate(item.link)}
                  >
                    <ListItemText
                      primary={
                        <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 0.5 }}>
                          {item.title}
                        </Typography>
                      }
                      secondary={
                        <>
                          <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                            {item.description}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {new Date(item.timestamp).toLocaleDateString('en-US', { 
                              month: 'long', 
                              day: 'numeric', 
                              year: 'numeric' 
                            })}
                          </Typography>
                        </>
                      }
                    />
                  </ListItem>
                ))}
              </List>
            )}
          </TabPanel>

          <TabPanel value={tabValue} index={1}>
            {/* Reports Tab */}
            <SectionTitle>Security Reports</SectionTitle>
            <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
              No reports submitted yet
            </Typography>
          </TabPanel>

          <TabPanel value={tabValue} index={2}>
            {/* Comments Tab */}
            <SectionTitle>Comments</SectionTitle>
            <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
              No comments yet
            </Typography>
          </TabPanel>

          {(user.isPublic || isOwnProfile) && (
            <TabPanel value={tabValue} index={3}>
              {/* Bookmarks Tab */}
              <SectionTitle>Bookmarks</SectionTitle>
              <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                {isOwnProfile ? 'No bookmarks yet. Bookmark reports and vulnerabilities to see them here.' : 'No public bookmarks'}
              </Typography>
            </TabPanel>
          )}
        </ContentSection>

        {/* Additional Info Section (if personalInfo exists) */}
        {user.personalInfo && (
          <ContentSection>
            <SectionTitle>About</SectionTitle>
            <Box
              sx={{
                p: 2,
                backgroundColor: (theme) => theme.palette.mode === 'light' ? '#fafafa' : '#1a1a1a',
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 1,
              }}
            >
              <MarkdownView content={user.personalInfo} sx={{ p: 0 }} />
            </Box>
          </ContentSection>
        )}
      </Box>
    </ProfileContainer>
  );
};
