import React, { useState, useEffect } from 'react';
import { TextField, Button, Grid, Paper, Typography, Box, IconButton, InputAdornment, Tooltip } from '@mui/material';
import { useEditProfile } from './hooks/edit-profile.hook';
import { styled } from '@mui/material/styles';
import { showError, showSuccess } from '../../../dialog-handler/dialog-handler';
import { Editor } from '@monaco-editor/react';
import { useTheme as useThemeContext } from '../../../../contexts/ThemeContext';
import { useNavigate } from 'react-router-dom';
import GoogleIcon from '@mui/icons-material/Google';
import GitHubIcon from '@mui/icons-material/GitHub';
import XIcon from '@mui/icons-material/X';
import ChatIcon from '@mui/icons-material/Chat';
import LinkIcon from '@mui/icons-material/Link';
import LinkOffIcon from '@mui/icons-material/LinkOff';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { AvatarUpload } from '../../../../components/AvatarUpload';
import { getUserInitials } from '../../../../utils/user-utils';
import { ConnectedAccountItem } from '../../../../api/soroban-security-portal/models/user';

const ProfileContainer = styled(Box)(({ theme }) => ({
  minHeight: '100vh',
  color: theme.palette.text.primary,
  padding: theme.spacing(3),
}));

const ProfileHeader = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginBottom: theme.spacing(4),
  padding: theme.spacing(3, 0),
}));

const ContentSection = styled(Paper)(({ theme }) => ({
  border: '1px solid #f2f2f2', // Light gray border
  borderRadius: '8px',
  padding: theme.spacing(3),
  marginBottom: theme.spacing(3),
  boxShadow: 'none',
}));

const SectionTitle = styled(Typography)(({ theme }) => ({
  fontSize: '18px',
  fontWeight: 'bold',
  color: theme.palette.text.primary,
  marginBottom: theme.spacing(2),
}));

const AccountItem = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: theme.spacing(2, 0),
  '&:last-child': {
    borderBottom: 'none',
  },
}));

const AccountInfo = styled(Box)(() => ({
  display: 'flex',
  alignItems: 'center',
}));

const AccountIcon = styled(Box)(({ theme }) => ({
  width: 24,
  height: 24,
  marginRight: theme.spacing(2),
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
}));

const AccountName = styled(Typography)(({ theme }) => ({
  fontSize: '14px',
  color: theme.palette.text.primary,
  fontWeight: 500,
}));

/** GitHub profile URL regex: https://github.com/username */
const GITHUB_URL_REGEX = /^https?:\/\/(www\.)?github\.com\/[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?\/?$/;
/** X (Twitter) profile URL regex: https://x.com/username or https://twitter.com/username */
const X_URL_REGEX = /^https?:\/\/(www\.)?(x\.com|twitter\.com)\/[a-zA-Z0-9_]{1,15}\/?$/;

/** Extracts the service-specific AccountId from user's connected accounts, or returns empty string */
const getConnectedAccountId = (accounts: ConnectedAccountItem[] | undefined, serviceName: string): string => {
  if (!accounts) return '';
  const match = accounts.find(a => a.serviceName === serviceName);
  return match?.accountId || '';
};

/** Returns the SSO-connected accounts only (Google, Discord) */
const getSSOAccounts = (accounts: ConnectedAccountItem[] | undefined): ConnectedAccountItem[] => {
  if (!accounts) return [];
  return accounts.filter(a => a.serviceName === 'Google' || a.serviceName === 'Discord');
};

export const EditProfile: React.FC = () => {
  const navigate = useNavigate();
  const { themeMode } = useThemeContext();
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [aboutYou, setAboutYou] = useState('');
  const [image, setImage] = useState<string | null>(null);
  const [githubUrl, setGithubUrl] = useState('');
  const [xUrl, setXUrl] = useState('');
  const [githubError, setGithubError] = useState('');
  const [xError, setXError] = useState('');

  const {
    user,
    updateProfile,
    isLoading
  } = useEditProfile();

  useEffect(() => {
    if (user) {
      setName(user.fullName || '');
      setUsername(user.login || '');
      setAboutYou(user.personalInfo || '');
      setGithubUrl(getConnectedAccountId(user.connectedAccounts, 'GitHub'));
      setXUrl(getConnectedAccountId(user.connectedAccounts, 'X'));
    }
  }, [user]);

  const validateGithubUrl = (url: string): boolean => {
    if (!url.trim()) {
      setGithubError('');
      return true;
    }
    if (!GITHUB_URL_REGEX.test(url.trim())) {
      setGithubError('Enter a valid GitHub profile URL (e.g., https://github.com/username)');
      return false;
    }
    setGithubError('');
    return true;
  };

  const validateXUrl = (url: string): boolean => {
    if (!url.trim()) {
      setXError('');
      return true;
    }
    if (!X_URL_REGEX.test(url.trim())) {
      setXError('Enter a valid X/Twitter profile URL (e.g., https://x.com/username)');
      return false;
    }
    setXError('');
    return true;
  };

  const handleSaveProfile = async () => {
    if (!name.trim()) {
      showError('Name is required');
      return;
    }

    // Validate social URLs before saving
    const isGithubValid = validateGithubUrl(githubUrl);
    const isXValid = validateXUrl(xUrl);
    if (!isGithubValid || !isXValid) {
      showError('Please fix the social profile URL errors before saving.');
      return;
    }

    let avatarImage = image;

    if (!avatarImage) {
      const avatarElement = document.querySelector('.MuiAvatar-root') as HTMLElement;
      if (avatarElement) {
        const canvas = document.createElement('canvas');
        const scaleFactor = 2; // Increase PPI by scaling the canvas
        canvas.width = avatarElement.offsetWidth * scaleFactor;
        canvas.height = avatarElement.offsetHeight * scaleFactor;
        const context = canvas.getContext('2d');
        if (context) {
          context.scale(scaleFactor, scaleFactor); // Scale the drawing context
          context.fillStyle = 'rgb(147, 134, 182)';
          context.fillRect(0, 0, canvas.width / scaleFactor, canvas.height / scaleFactor);
          context.font = '400 25px Roboto, Rubik, Helvetica, Arial, sans-serif';
          context.fillStyle = 'rgb(30, 30, 30)';
          context.textAlign = 'center';
          context.textBaseline = 'middle';
          context.fillText(
            getUserInitials(name || 'User Name'),
            canvas.width / (2 * scaleFactor),
            canvas.height / (2 * scaleFactor) + 1 // Move text 1 pixel down
          );
        }
        avatarImage = canvas.toDataURL('image/png').split(',')[1]; // Convert to base64
      }
    }

    // Build connected accounts: preserve non-editable accounts (SSO, etc.) + add/update social links
    const updatedConnectedAccounts: ConnectedAccountItem[] = [
      // Preserve all accounts that are not GitHub or X (e.g., Google SSO, Discord SSO, future types)
      ...(user?.connectedAccounts || []).filter(
        a => a.serviceName !== 'GitHub' && a.serviceName !== 'X'
      ),
    ];

    // Add GitHub if URL is provided
    if (githubUrl.trim()) {
      updatedConnectedAccounts.push({ serviceName: 'GitHub', accountId: githubUrl.trim() });
    }

    // Add X if URL is provided
    if (xUrl.trim()) {
      updatedConnectedAccounts.push({ serviceName: 'X', accountId: xUrl.trim() });
    }

    const updateSuccess = await updateProfile({
      fullName: name,
      login: username,
      personalInfo: aboutYou,
      image: avatarImage || undefined,
      connectedAccounts: updatedConnectedAccounts,
    });

    if (updateSuccess) {
      showSuccess('Profile updated successfully');
      navigate('/profile');
    } else {
      showError('Failed to update profile');
    }
  };

  const handleDisconnectGithub = () => {
    setGithubUrl('');
    setGithubError('');
  };

  const handleDisconnectX = () => {
    setXUrl('');
    setXError('');
  };

  const ssoAccounts = [
    { name: 'Google account', icon: <GoogleIcon sx={{ color: 'primary.main' }} />, connected: getSSOAccounts(user?.connectedAccounts).some(a => a.serviceName === 'Google') },
    { name: 'Discord account', icon: <ChatIcon sx={{ color: 'primary.main' }} />, connected: getSSOAccounts(user?.connectedAccounts).some(a => a.serviceName === 'Discord') },
  ];

  return (
    <ProfileContainer>
      <Box sx={{ margin: '0 auto' }}>
        {/* Profile Header */}
        <ProfileHeader>

          <Button
            variant="contained"
            onClick={handleSaveProfile}
            disabled={isLoading}
          >
            Save Profile
          </Button>
        </ProfileHeader>
        <AvatarUpload
          placeholder={getUserInitials(user?.fullName || 'User Name')}
          setImageCallback={setImage}
          initialImage={user?.image || null}
        />
        <Box sx={{ display: 'flex', flexDirection: 'column', ml: 2 }}>
          <Typography sx={{ fontSize: '28px', fontWeight: 600, color: 'text.primary', mb: '4px' }}>
            {user?.fullName}
          </Typography>
          <Typography sx={{ fontSize: '14px', color: 'text.primary', mb: '4px' }}>
            Joined {user?.created ? new Date(user.created).toLocaleDateString() : ''}
          </Typography>
        </Box>

        {/* Personal Information Section */}
        <ContentSection>
          <SectionTitle>
            Personal Information
          </SectionTitle>
          <Grid container spacing={3}>
            <Grid size={6}>
              <TextField
                fullWidth
                label="Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </Grid>
            <Grid size={6}>
              <TextField
                fullWidth
                label="Username"
                value={username}
                disabled
                onChange={(e) => setUsername(e.target.value)}
              />
            </Grid>
            <Grid size={12}>
              <Typography variant="body2" sx={{ color: 'text.primary', mb: 1 }}>
                About you
              </Typography>
              <Editor
                height="200px"
                language="markdown"
                value={aboutYou}
                theme={themeMode === 'light' ? 'vs' : 'vs-dark'}
                onChange={(value) => setAboutYou(value ?? '')}
                options={{
                  minimap: { enabled: false },
                  scrollBeyondLastLine: false,
                  fontSize: 14,
                }}
              />
            </Grid>
          </Grid>
        </ContentSection>
        {/* Connected Accounts Section */}
        <ContentSection>
          <SectionTitle>
            Connected accounts
          </SectionTitle>

          {/* SSO accounts (Google, Discord) — read-only; connected via OAuth login */}
          {ssoAccounts.map((account, index) => (
            <AccountItem key={index}>
              <AccountInfo>
                <AccountIcon>
                  {account.icon}
                </AccountIcon>
                <AccountName>
                  {account.name}
                </AccountName>
              </AccountInfo>
              <Typography
                variant="body2"
                sx={{
                  color: account.connected ? 'success.main' : 'text.disabled',
                  fontWeight: 500,
                }}
              >
                {account.connected ? 'Connected via SSO' : 'Not connected'}
              </Typography>
            </AccountItem>
          ))}

          {/* GitHub — editable social link */}
          <AccountItem>
            <AccountInfo>
              <AccountIcon>
                <GitHubIcon sx={{ color: githubUrl ? 'primary.main' : 'text.disabled' }} />
              </AccountIcon>
              <AccountName>
                GitHub profile
              </AccountName>
            </AccountInfo>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1, maxWidth: 400, ml: 2 }}>
              <TextField
                fullWidth
                size="small"
                placeholder="https://github.com/username"
                value={githubUrl}
                onChange={(e) => {
                  setGithubUrl(e.target.value);
                  if (githubError) validateGithubUrl(e.target.value);
                }}
                onBlur={() => validateGithubUrl(githubUrl)}
                error={!!githubError}
                helperText={githubError || undefined}
                slotProps={{
                  input: {
                    startAdornment: (
                      <InputAdornment position="start">
                        <LinkIcon fontSize="small" color={githubUrl ? 'primary' : 'disabled'} />
                      </InputAdornment>
                    ),
                    endAdornment: githubUrl ? (
                      <InputAdornment position="end">
                        <Tooltip title="Open profile">
                          <IconButton
                            size="small"
                            onClick={() => window.open(githubUrl, '_blank', 'noopener,noreferrer')}
                            edge="end"
                          >
                            <OpenInNewIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Disconnect">
                          <IconButton
                            size="small"
                            onClick={handleDisconnectGithub}
                            edge="end"
                            sx={{ color: 'error.main' }}
                          >
                            <LinkOffIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </InputAdornment>
                    ) : undefined,
                  },
                }}
              />
            </Box>
          </AccountItem>

          {/* X (Twitter) — editable social link */}
          <AccountItem>
            <AccountInfo>
              <AccountIcon>
                <XIcon sx={{ color: xUrl ? 'primary.main' : 'text.disabled' }} />
              </AccountIcon>
              <AccountName>
                X (Twitter) profile
              </AccountName>
            </AccountInfo>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1, maxWidth: 400, ml: 2 }}>
              <TextField
                fullWidth
                size="small"
                placeholder="https://x.com/username"
                value={xUrl}
                onChange={(e) => {
                  setXUrl(e.target.value);
                  if (xError) validateXUrl(e.target.value);
                }}
                onBlur={() => validateXUrl(xUrl)}
                error={!!xError}
                helperText={xError || undefined}
                slotProps={{
                  input: {
                    startAdornment: (
                      <InputAdornment position="start">
                        <LinkIcon fontSize="small" color={xUrl ? 'primary' : 'disabled'} />
                      </InputAdornment>
                    ),
                    endAdornment: xUrl ? (
                      <InputAdornment position="end">
                        <Tooltip title="Open profile">
                          <IconButton
                            size="small"
                            onClick={() => window.open(xUrl, '_blank', 'noopener,noreferrer')}
                            edge="end"
                          >
                            <OpenInNewIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Disconnect">
                          <IconButton
                            size="small"
                            onClick={handleDisconnectX}
                            edge="end"
                            sx={{ color: 'error.main' }}
                          >
                            <LinkOffIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </InputAdornment>
                    ) : undefined,
                  },
                }}
              />
            </Box>
          </AccountItem>
        </ContentSection>
      </Box>
    </ProfileContainer>
  );
}; 