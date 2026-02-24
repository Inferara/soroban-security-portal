import React, { useState, useEffect } from 'react';
import { TextField, Button, Grid, Paper, Typography, Box, Stack, InputAdornment } from '@mui/material';
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
import LanguageIcon from '@mui/icons-material/Language';
import { AvatarUpload } from '../../../../components/AvatarUpload';
import { getUserInitials } from '../../../../utils/user-utils';
import {
  MAX_BIO_LENGTH,
  isValidTwitterUrl,
  isValidGitHubUrl,
  isValidWebsiteUrl,
} from '../../../../api/soroban-security-portal/models/user';
import { ExpertiseTagsInput } from '../../../../features/components/Expertisetagsinput';
import { CharacterCounter } from '../../../../features/components/CharacterCounter';

const ProfileContainer = styled(Box)(({ theme }) => ({
  minHeight: '100vh',
  color: '#ffffff',
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
  border: '1px solid #f2f2f2',
  borderRadius: '8px',
  padding: theme.spacing(3),
  marginBottom: theme.spacing(3),
  boxShadow: 'none',
}));

const SectionTitle = styled(Typography)(({ theme }) => ({
  fontSize: '18px',
  fontWeight: 'bold',
  color: '#ffffff',
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

const AccountName = styled(Typography)(() => ({
  fontSize: '14px',
  color: '#ffffff',
  fontWeight: 500,
}));

export const EditProfile: React.FC = () => {
  const navigate = useNavigate();
  const { themeMode } = useThemeContext();
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [aboutYou, setAboutYou] = useState('');
  const [image, setImage] = useState<string | null>(null);
  const [website, setWebsite] = useState('');
  const [twitter, setTwitter] = useState('');
  const [github, setGithub] = useState('');
  const [discord, setDiscord] = useState('');
  const [expertiseTags, setExpertiseTags] = useState<string[]>([]);
  const [socialErrors, setSocialErrors] = useState<{
    website?: string;
    twitter?: string;
    github?: string;
  }>({});

  const { user, updateProfile, isLoading } = useEditProfile();

  useEffect(() => {
    if (user) {
      setName(user.fullName || '');
      setUsername(user.login || '');
      setAboutYou(user.personalInfo || '');
      setWebsite(user.website || '');
      setTwitter(user.twitter || '');
      setGithub(user.github || '');
      setDiscord(user.discord || '');
      setExpertiseTags(user.expertiseTags || []);
    }
  }, [user]);

  const validateSocials = (): boolean => {
    const errors: typeof socialErrors = {};
    if (website && !isValidWebsiteUrl(website)) {
      errors.website = 'Enter a valid URL, e.g. https://yoursite.com';
    }
    if (twitter && !isValidTwitterUrl(twitter)) {
      errors.twitter = 'Enter a valid Twitter/X profile URL, e.g. https://twitter.com/username';
    }
    if (github && !isValidGitHubUrl(github)) {
      errors.github = 'Enter a valid GitHub profile URL, e.g. https://github.com/username';
    }
    setSocialErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSaveProfile = async () => {
    if (!name.trim()) {
      showError('Name is required');
      return;
    }

    if (aboutYou.length > MAX_BIO_LENGTH) {
      showError(`Bio must be ${MAX_BIO_LENGTH} characters or fewer`);
      return;
    }

    if (!validateSocials()) {
      showError('Please fix the highlighted social link errors');
      return;
    }

    let avatarImage = image;

    if (!avatarImage) {
      const avatarElement = document.querySelector('.MuiAvatar-root') as HTMLElement;
      if (avatarElement) {
        const canvas = document.createElement('canvas');
        const scaleFactor = 2;
        canvas.width = avatarElement.offsetWidth * scaleFactor;
        canvas.height = avatarElement.offsetHeight * scaleFactor;
        const context = canvas.getContext('2d');
        if (context) {
          context.scale(scaleFactor, scaleFactor);
          context.fillStyle = 'rgb(147, 134, 182)';
          context.fillRect(0, 0, canvas.width / scaleFactor, canvas.height / scaleFactor);
          context.font = '400 25px Roboto, Rubik, Helvetica, Arial, sans-serif';
          context.fillStyle = 'rgb(30, 30, 30)';
          context.textAlign = 'center';
          context.textBaseline = 'middle';
          context.fillText(
            getUserInitials(name || 'User Name'),
            canvas.width / (2 * scaleFactor),
            canvas.height / (2 * scaleFactor) + 1
          );
        }
        avatarImage = canvas.toDataURL('image/png').split(',')[1];
      }
    }

    const updateSuccess = await updateProfile({
      fullName: name,
      login: username,
      personalInfo: aboutYou,
      image: avatarImage || undefined,
      website,
      twitter,
      github,
      discord,
      expertiseTags,
    });

    if (updateSuccess) {
      showSuccess('Profile updated successfully');
      navigate('/profile');
    } else {
      showError('Failed to update profile');
    }
  };

  const connectedAccounts = [
    { name: 'Google account', icon: <GoogleIcon sx={{ color: 'primary.main' }} />, connected: false },
    { name: 'Discord account', icon: <ChatIcon sx={{ color: 'primary.main' }} />, connected: false },
    { name: 'GitHub account', icon: <GitHubIcon sx={{ color: 'primary.main' }} />, connected: false },
    { name: 'X account', icon: <XIcon sx={{ color: 'primary.main' }} />, connected: false },
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
          <SectionTitle>Personal Information</SectionTitle>
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
              <Typography variant="body2" sx={{ color: '#ffffff', mb: 1 }}>
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
              {/* Character counter lives below the Monaco editor */}
              <CharacterCounter current={aboutYou.length} max={MAX_BIO_LENGTH} />
            </Grid>
          </Grid>
        </ContentSection>
        <ContentSection>
          <SectionTitle>Social Links</SectionTitle>
          <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
            Twitter and GitHub must be full profile URLs.
          </Typography>
          <Stack spacing={2.5}>
            <TextField
              fullWidth
              label="Website"
              value={website}
              onChange={(e) => { setWebsite(e.target.value); setSocialErrors((p) => ({ ...p, website: undefined })); }}
              onBlur={validateSocials}
              placeholder="https://yoursite.com"
              error={Boolean(socialErrors.website)}
              helperText={socialErrors.website}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <LanguageIcon fontSize="small" color="action" />
                  </InputAdornment>
                ),
              }}
            />
            <TextField
              fullWidth
              label="Twitter / X"
              value={twitter}
              onChange={(e) => { setTwitter(e.target.value); setSocialErrors((p) => ({ ...p, twitter: undefined })); }}
              onBlur={validateSocials}
              placeholder="https://twitter.com/username"
              error={Boolean(socialErrors.twitter)}
              helperText={socialErrors.twitter}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <XIcon fontSize="small" color="action" />
                  </InputAdornment>
                ),
              }}
            />
            <TextField
              fullWidth
              label="GitHub"
              value={github}
              onChange={(e) => { setGithub(e.target.value); setSocialErrors((p) => ({ ...p, github: undefined })); }}
              onBlur={validateSocials}
              placeholder="https://github.com/username"
              error={Boolean(socialErrors.github)}
              helperText={socialErrors.github}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <GitHubIcon fontSize="small" color="action" />
                  </InputAdornment>
                ),
              }}
            />
            <TextField
              fullWidth
              label="Discord"
              value={discord}
              onChange={(e) => setDiscord(e.target.value)}
              placeholder="your username"
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <ChatIcon fontSize="small" color="action" />
                  </InputAdornment>
                ),
              }}
            />
          </Stack>
        </ContentSection>
        <ContentSection>
          <SectionTitle>Expertise Tags</SectionTitle>
          <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
            Highlight your skills — these appear as chips on your profile.
          </Typography>
          <ExpertiseTagsInput
            value={expertiseTags}
            onChange={setExpertiseTags}
          />
        </ContentSection>

        {/* Connected Accounts Section */}
        <ContentSection>
          <SectionTitle>Connected accounts</SectionTitle>
          {connectedAccounts.map((account, index) => (
            <AccountItem key={index}>
              <AccountInfo>
                <AccountIcon>{account.icon}</AccountIcon>
                <AccountName>{account.name}</AccountName>
              </AccountInfo>
              <Button
                disabled={false}
                variant="contained"
                sx={{
                  color: 'background.default',
                  borderColor: 'primary.main',
                  backgroundColor: 'primary.main',
                  textTransform: 'none',
                  '&:hover': {
                    backgroundColor: 'rgba(250, 250, 250, 0.1)',
                    borderColor: 'primary.main',
                    color: 'primary.main',
                  },
                }}
              >
                Connect
              </Button>
            </AccountItem>
          ))}
        </ContentSection>
      </Box>
    </ProfileContainer>
  );
};