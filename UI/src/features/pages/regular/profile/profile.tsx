import React, { useState } from 'react';
import { TextField, Button, Grid, Paper, Typography, Box, Avatar } from '@mui/material';
import { useProfile } from './hooks';
import { styled } from '@mui/material/styles';
import { showError, showSuccess } from '../../../dialog-handler/dialog-handler';
import LockIcon from '@mui/icons-material/Lock';
import EditIcon from '@mui/icons-material/Edit';
import ReactMarkdown from 'react-markdown';
import { useNavigate } from 'react-router-dom';

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
  backgroundColor: '#9386b6', 
  border: '3px solid #FCD34D',
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

const EditButton = styled(Button)(({ theme }) => ({
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

const PlaceholderText = styled(Typography)(() => ({
  fontSize: '14px',
  color: '#9CA3AF',
  fontStyle: 'italic',
}));

const MarkdownContainer = styled(Box)(({ theme }) => ({
  fontSize: '14px',
  color: '#ffffff',
  '& h1, & h2, & h3, & h4, & h5, & h6': {
    color: '#ffffff',
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
    backgroundColor: '#374151',
    padding: '2px 4px',
    borderRadius: '4px',
    fontSize: '13px',
  },
  '& pre': {
    backgroundColor: '#374151',
    padding: theme.spacing(1),
    borderRadius: '4px',
    overflow: 'auto',
  },
  '& blockquote': {
    borderLeft: '4px solid #3B82F6',
    paddingLeft: theme.spacing(2),
    marginLeft: 0,
    fontStyle: 'italic',
  },
  '& a': {
    color: '#3B82F6',
    textDecoration: 'none',
    '&:hover': {
      textDecoration: 'underline',
    },
  },
}));

export const Profile: React.FC = () => {
  const navigate = useNavigate();
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const {
    changePassword,
    user,
    userId
  } = useProfile();

  const handleChangePassword = async () => {
    if (newPassword !== confirmPassword) {
      showError('New passwords do not match');
      return;
    }
    
    const changePasswordSuccess = await changePassword(oldPassword, newPassword);
    if (changePasswordSuccess) {
      showSuccess('Password changed successfully');
    } else {
      showError('Password change failed');
    }
  }

  // Get user initials for avatar
  const getUserInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <ProfileContainer>
      <Box sx={{ margin: '0 auto' }}>
        {/* Profile Header */}
        <ProfileHeader>
          <AvatarContainer>
            <StyledAvatar>
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
            false && userId == 0 && (
              <EditButton
                variant="contained"
                startIcon={<EditIcon />}
                onClick={() => {
                  navigate('/profile/edit');
                }}
              >
                Edit Profile
              </EditButton>
            )
          }
        </ProfileHeader>

        {/* Content Sections */}
        <ContentSection>
          <SectionTitle>
            Personal Information
          </SectionTitle>
          {user?.personalInfo ? (
            <MarkdownContainer>
              <ReactMarkdown>{user.personalInfo}</ReactMarkdown>
            </MarkdownContainer>
          ) : (
            <PlaceholderText>
              {userId == 0 ? 'Fill your info in Edit Profile page' : ''}
            </PlaceholderText>
          )}
        </ContentSection>

        <ContentSection>
          <SectionTitle>
            Connected accounts
          </SectionTitle>
          <PlaceholderText>
          {user?.connectedAccounts && user?.connectedAccounts.length > 0 ? user?.connectedAccounts.map(account => (
            <div key={account.serviceName }>
              {account.serviceName}: {account.accountId}
            </div>
          )) : (userId == 0 ? 'You can connect accounts in Edit Profile page' : '')}
          </PlaceholderText>
        </ContentSection>

        {/* Password Change Section - Hidden by default, can be shown in Edit Profile */}
        {user?.loginType === "Password" && false && (
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
                  fullWidth
                  sx={{ 
                    mt: 1,
                    backgroundColor: '#3B82F6',
                    '&:hover': {
                      backgroundColor: '#2563EB',
                    },
                  }}
                >
                  Update Password
                </Button>
              </Grid>
            </Grid>
          </ContentSection>
        )}
      </Box>
    </ProfileContainer>
  );
} 