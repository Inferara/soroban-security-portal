import React, { useState, useEffect, useRef } from 'react';
import { TextField, Button, Grid, Paper, Typography, Box, Avatar, IconButton, Tooltip, CircularProgress } from '@mui/material';
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
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera';
import DeleteIcon from '@mui/icons-material/Delete';

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

const AvatarContainer = styled(Box)(() => ({
  display: 'flex',
  alignItems: 'center',
}));

const StyledAvatar = styled(Avatar)(({ theme }) => ({
  width: 80,
  height: 80,
  marginRight: theme.spacing(3),
  backgroundColor: '#9386b6', // Purple background
  border: '3px solid #FCD34D', // Yellow-gold border
  fontSize: '24px',
  fontWeight: 'bold',
}));

const UserInfo = styled(Box)(() => ({
  display: 'flex',
  flexDirection: 'column',
}));

const UserName = styled(Typography)(({ theme }) => ({
  fontSize: '28px',
  fontWeight: 'bold',
  color: '#ffffff',
  marginBottom: theme.spacing(1),
}));

const UserDetails = styled(Typography)(() => ({
  fontSize: '14px',
  color: '#ffffff',
  marginBottom: '4px',
}));

const SaveButton = styled(Button)(({ theme }) => ({
  backgroundColor: '#3B82F6', // Blue background
  color: '#ffffff',
  borderRadius: '8px',
  padding: theme.spacing(1, 3),
  textTransform: 'none',
  fontSize: '14px',
  fontWeight: 500,
  '&:hover': {
    backgroundColor: '#2563EB',
  },
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
  color: '#ffffff',
  marginBottom: theme.spacing(2),
}));

const ConnectButton = styled(Button)(({ theme }) => ({
  backgroundColor: '#fafafa',
  '&:disabled': {
    backgroundColor: '#4b4646ff', // Slightly darker gray for disabled state
  },
  width: '100px',
  color: '#374151', // Dark gray text
  borderRadius: '8px',
  padding: theme.spacing(1, 2),
  textTransform: 'none',
  fontSize: '12px',
  fontWeight: 500,
  '&:hover': {
    backgroundColor: '#aaaaaa',
  },
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

const AvatarControls = styled(Box)(() => ({
  position: 'relative',
  display: 'inline-block',
}));

const ImageControlButton = styled(IconButton)(() => ({
  position: 'absolute',
  backgroundColor: 'rgba(0, 0, 0, 0.7)',
  color: '#ffffff',
  width: 32,
  height: 32,
  border: '2px solid rgba(255, 255, 255, 0.3)',
  transition: 'all 0.2s ease-in-out',
  '&:hover': {
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    border: '2px solid rgba(255, 255, 255, 0.5)',
    transform: 'scale(1.1)',
  },
  '&:disabled': {
    opacity: 0.5,
  },
}));

const UploadButton = styled(ImageControlButton)(() => ({
  bottom: 0,
  right: 0,
}));

const RemoveButton = styled(ImageControlButton)(() => ({
  top: 0,
  right: 0,
}));

const HiddenFileInput = styled('input')(() => ({
  display: 'none',
}));

export const EditProfile: React.FC = () => {
  const navigate = useNavigate();
  const { themeMode } = useThemeContext();
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [aboutYou, setAboutYou] = useState('');
  const [image, setImage] = useState<string | null>(null);
  const [isImageUploading, setIsImageUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      setImage(user.image || null);
    }
  }, [user]);

  const handleSaveProfile = async () => {
    if (!name.trim()) {
      showError('Name is required');
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

    const updateSuccess = await updateProfile({
      fullName: name,
      login: username,
      personalInfo: aboutYou,
      image: avatarImage || undefined,
    });

    if (updateSuccess) {
      showSuccess('Profile updated successfully');
      navigate('/profile');
    } else {
      showError('Failed to update profile');
    }
  };

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        showError('Please select an image file');
        return;
      }

      // Validate file size (max 100KB)
      if (file.size > 100 * 1024) {
        showError('Image size must be less than 100KB');
        return;
      }

      setIsImageUploading(true);
      const reader = new FileReader();
      reader.onloadend = () => {
        try {
          const result = reader.result as string;
          // Convert data URL to base64 string (remove the data:image/...;base64, prefix)
          const base64String = result.split(',')[1];
          setImage(base64String);
          showSuccess('Image uploaded successfully');
        } catch (error) {
          showError('Failed to process image');
        } finally {
          setIsImageUploading(false);
        }
      };
      reader.onerror = () => {
        showError('Failed to read image file');
        setIsImageUploading(false);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveImage = () => {
    setImage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = ''; // Clear file input value
    }
  };

  // Helper function to determine image type from base64 string
  const getImageSrc = (base64String: string) => {
    // Try to detect image type from the first few characters
    if (base64String.startsWith('/9j/') || base64String.startsWith('/9j/')) {
      return `data:image/jpeg;base64,${base64String}`;
    } else if (base64String.startsWith('iVBORw0KGgo')) {
      return `data:image/png;base64,${base64String}`;
    } else if (base64String.startsWith('R0lGODlh')) {
      return `data:image/gif;base64,${base64String}`;
    } else {
      // Default to JPEG if we can't determine the type
      return `data:image/jpeg;base64,${base64String}`;
    }
  };

  // Get user initials for avatar
  const getUserInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const connectedAccounts = [
    { name: 'Google account', icon: <GoogleIcon sx={{ color: '#ffffff' }} />, connected: false },
    { name: 'Discord account', icon: <ChatIcon sx={{ color: '#ffffff' }} />, connected: false },
    { name: 'GitHub account', icon: <GitHubIcon sx={{ color: '#ffffff' }} />, connected: false },
    { name: 'X account', icon: <XIcon sx={{ color: '#ffffff' }} />, connected: false },
  ];

  return (
    <ProfileContainer>
      <Box sx={{ margin: '0 auto' }}>
        {/* Profile Header */}
        <ProfileHeader>
          <AvatarContainer>
            <AvatarControls>
              <StyledAvatar>
                {image ? (
                  <img 
                    src={getImageSrc(image)} 
                    alt="User avatar"
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  getUserInitials(user?.fullName || 'User Name')
                )}
              </StyledAvatar>
              <Tooltip title="Upload new avatar" sx={{mr:1}}>
                <UploadButton
                  onClick={() => fileInputRef.current?.click()}
                  size="small"
                  disabled={isImageUploading}
                >
                  {isImageUploading ? <CircularProgress size={20} color="inherit" /> : <PhotoCameraIcon fontSize="small" />}
                </UploadButton>
              </Tooltip>
              {image && (
                <Tooltip title="Remove avatar" sx={{mr:1}}>
                  <RemoveButton
                    onClick={handleRemoveImage}
                    size="small"
                  >
                    <DeleteIcon fontSize="small" />
                  </RemoveButton>
                </Tooltip>
              )}
              <HiddenFileInput
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
              />
            </AvatarControls>
            <UserInfo sx={{ ml: 2}}>
              <UserName >
                {user?.fullName}
              </UserName>
              <UserDetails>
                Joined {user?.created ? new Date(user.created).toLocaleDateString() : ''}
              </UserDetails>
            </UserInfo>
          </AvatarContainer>
          <SaveButton
            variant="contained"
            onClick={handleSaveProfile}
            disabled={isLoading}
          >
            Save Profile
          </SaveButton>
        </ProfileHeader>

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
            </Grid>
          </Grid>
        </ContentSection>

        {/* Connected Accounts Section */}
        <ContentSection>
          <SectionTitle>
            Connected accounts
          </SectionTitle>
          {connectedAccounts.map((account, index) => (
            <AccountItem key={index}>
              <AccountInfo>
                <AccountIcon>
                  {account.icon}
                </AccountIcon>
                <AccountName>
                  {account.name}
                </AccountName>
              </AccountInfo>
              <ConnectButton disabled={true}>
                Connect
              </ConnectButton>
            </AccountItem>
          ))}
        </ContentSection>
      </Box>
    </ProfileContainer>
  );
}; 