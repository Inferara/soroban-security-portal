import { ChangeEvent, FC, useState } from 'react';
import {
  TextField,
  Button,
  Typography,
  CircularProgress,
  Box,
  Divider,
  IconButton,
  InputAdornment,
} from '@mui/material';
import { useAuth } from 'react-oidc-context';
import { environment } from './../../environments/environment';
import { Visibility, VisibilityOff } from '@mui/icons-material';

interface Props {
  errorText: string;
  isLoading: boolean;
}

export const Authentication: FC<Props> = (props: Props) => {
  const auth = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleUsernameChange = (event: ChangeEvent<HTMLInputElement>) => {
    setUsername(event.target.value);
  };

  const handlePasswordChange = (event: ChangeEvent<HTMLInputElement>) => {
    setPassword(event.target.value);
  };

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  const handleLogin = async () => {
    localStorage.removeItem(`oidc.user:${environment.apiUrl}/api/v1/connect:${environment.clientId}`);
    const signinRedirectArgs = {
      acr_values: `${username}:${password}`,
    };
    await auth.signinSilent(signinRedirectArgs);
  };

  const handleSsoLogin = async (ssoTypeIdentifier: string) => {
    const signinRedirectArgs = {
      acr_values: ssoTypeIdentifier,
    };
    await auth.signinRedirect(signinRedirectArgs);
  };

  return (
    <Box 
      sx={{ 
        width: '100vw',
        height: '100vh',
        display: 'flex',
        position: 'fixed',
        top: 0,
        left: 0,
      }}
    >
      {/* Left Column - Login Form */}
      <Box
        sx={{
          width: '40%',
          backgroundColor: 'white',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '40px',
        }}
      >
        {props.isLoading ? (
          // Show only spinner when loading
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
            }}
          >
            <CircularProgress 
              size={60} 
              sx={{ 
                color: '#1976d2',
                marginBottom: '20px',
              }} 
            />
            <Typography 
              variant="h6" 
              sx={{ 
                color: 'grey.600',
                textAlign: 'center',
              }}
            >
              Signing you in...
            </Typography>
          </Box>
        ) : (
          // Show login form when not loading
          <Box
            sx={{
              width: '100%',
              maxWidth: '400px',
            }}
          >
            {/* Title */}
            <Typography 
              variant="h3" 
              component="h1" 
              sx={{ 
                fontWeight: 'bold',
                color: 'black',
                marginBottom: '40px',
                textAlign: 'center',
              }}
            >
              Enter the Portal!
            </Typography>

            {/* Username Field */}
            <Box sx={{ marginBottom: '20px' }}>             
              <TextField
                fullWidth
                value={username}
                onChange={handleUsernameChange}
                disabled={props.isLoading}
                placeholder="Username"
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: '10px',
                    border: '1px solid black',
                    WebkitTextFillColor: 'black',
                    WebkitBoxShadow: 'none',
                    '& fieldset': {
                      border: 'none',
                    },
                    '&:hover fieldset': {
                      border: 'none',
                    },
                    '&.Mui-focused fieldset': {
                      border: 'none',
                    },
                  },
                  '& .MuiInputBase-input': {
                    color: 'black',
                  },
                  '& .MuiOutlinedInput-input': {
                    '-webkit-text-fill-color': 'black !important',
                    '-webkit-box-shadow': 'none !important',
                  },
                  '& .MuiInputBase-input::placeholder': {
                    color: 'grey.500',
                    opacity: 1,
                  },
                }}
              />
            </Box>

            {/* Password Field */}
            <Box sx={{ marginBottom: '30px' }}>
              <TextField
                fullWidth
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={handlePasswordChange}
                disabled={props.isLoading}
                placeholder="Password"
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: '10px',
                    border: '1px solid black',
                    '& fieldset': {
                      border: 'none',
                    },
                    '&:hover fieldset': {
                      border: 'none',
                    },
                    '&.Mui-focused fieldset': {
                      border: 'none',
                    },
                  },
                  '& .MuiInputBase-input': {
                    color: 'black',
                  },
                  '& .MuiOutlinedInput-input': {
                    '-webkit-text-fill-color': 'black !important',
                    '-webkit-box-shadow': 'none !important',
                  },
                  '& .MuiInputBase-input::placeholder': {
                    color: 'grey.500',
                    opacity: 1,
                  },
                }}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        aria-label="toggle password visibility"
                        onClick={() => togglePasswordVisibility()}
                        edge="end"
                        sx={{
                          color: 'black',
                        }}
                      >
                        {showPassword ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />
            </Box>

            {/* Error Text */}
            {props.errorText && (
              <Typography 
                variant="body2" 
                sx={{ 
                  color: 'error.main',
                  fontSize: '0.8rem',
                  marginBottom: '20px',
                  textAlign: 'center',
                }}
              >
                {props.errorText}
              </Typography>
            )}

            {/* Login Button */}
            <Button
              fullWidth
              variant="contained"
              onClick={handleLogin}
              disabled={props.isLoading}
              sx={{
                backgroundColor: '#1976d2',
                color: 'white',
                borderRadius: '10px',
                padding: '12px',
                fontSize: '16px',
                fontWeight: 'bold',
                textTransform: 'none',
                marginBottom: '30px',
                '&:hover': {
                  backgroundColor: '#1565c0',
                },
              }}
            >
              Log in
            </Button>

            {/* Divider */}
            <Box sx={{ display: 'flex', alignItems: 'center', marginBottom: '20px' }}>
              <Divider sx={{ flex: 1, backgroundColor: 'grey.300' }} />
              <Typography 
                variant="body2" 
                sx={{ 
                  color: 'grey.600',
                  margin: '0 15px',
                  fontSize: '0.875rem',
                }}
              >
                or
              </Typography>
              <Divider sx={{ flex: 1, backgroundColor: 'grey.300' }} />
            </Box>

            {/* Social Login Buttons */}
            <Button
              fullWidth
              variant="outlined"
              onClick={() => handleSsoLogin('google')}
              disabled={props.isLoading}
              sx={{
                border: '1px solid #e0e0e0',
                borderRadius: '10px',
                padding: '12px',
                fontSize: '16px',
                textTransform: 'none',
                color: 'black',
                backgroundColor: 'white',
                marginBottom: '10px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                '&:hover': {
                  backgroundColor: '#f5f5f5',
                  border: '1px solid #e0e0e0',
                },
              }}
            >
              Sign in with Google &nbsp;
              <img
                src="/static/images/google.svg"
                alt="Google Logo"
                style={{ marginRight: '10px', height: '20px' }}
              />
            </Button>

            <Button
              fullWidth
              variant="outlined"
              onClick={() => handleSsoLogin('discord')}
              disabled={props.isLoading}
              sx={{
                border: '1px solid #e0e0e0',
                borderRadius: '10px',
                padding: '12px',
                fontSize: '16px',
                textTransform: 'none',
                color: 'black',
                backgroundColor: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                '&:hover': {
                  backgroundColor: '#f5f5f5',
                  border: '1px solid #e0e0e0',
                },
              }}
            >
              Sign in with Discord&nbsp;
              <img
                src="/static/images/discord.svg"
                alt="Discord Logo"
                style={{ marginRight: '10px', height: '20px' }}
              />
            </Button>
          </Box>
        )}
      </Box>

      {/* Right Column - Visual Element */}
      <Box
        sx={{
          width: '60%',
          backgroundColor: '#2c2c2c',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Box
          sx={{
            width: '300px',
            height: '300px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {/* Logo */}
          <img
            src="/static/images/logo.png"
            alt="Soroban Security Portal"
            style={{
              maxWidth: '100%',
              maxHeight: '100%',
              objectFit: 'contain',
            }}
          />
        </Box>
      </Box>
    </Box>
  );
};
