import { ChangeEvent, FC, useState } from 'react';
import {
  Card,
  CardMedia,
  CardActions,
  CardContent,
  TextField,
  Button,
  Typography,
  CircularProgress,
  Box,
} from '@mui/material';
import { useAuth } from 'react-oidc-context';
import Divider from '@mui/material/Divider';
import { environment } from './../../environments/environment';

interface Props {
  errorText: string;
  isLoading: boolean;
}

export const Authentication: FC<Props> = (props: Props) => {
  const auth = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const handleUsernameChange = (event: ChangeEvent<HTMLInputElement>) => {
    setUsername(event.target.value);
  };

  const handlePasswordChange = (event: ChangeEvent<HTMLInputElement>) => {
    setPassword(event.target.value);
  };

  const handleLogin = async () => {
    // clear the session storage to force the user to re-authenticate
    sessionStorage.removeItem(`oidc.user:${environment.aiCoreApiUrl}/api/v1/connect:${environment.clientId}`);
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

  const renderSsoSection = () => {
    return (
      <>
        <Button
          variant="outlined"
          onClick={() => handleSsoLogin('google')}
          sx={{
            margin: '10px auto',
            width: '230px',
            height: '41px',
            borderRadius: '4px',
            textTransform: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '16px',
            border: '2px solid',
            borderColor: 'divider',
            '&:hover': {
              backgroundColor: 'action.hover',
            },
          }}
        >
          <img
            src="/static/images/google.svg"
            alt="Google Logo"
            style={{ marginRight: '10px', height: '20px' }}
          />
          Sign in with Google
        </Button>
        <Button
          variant="outlined"
          onClick={() => handleSsoLogin('discord')}
          sx={{
            margin: '10px auto',
            width: '230px',
            height: '41px',
            borderRadius: '4px',
            textTransform: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '16px',
            border: '2px solid',
            borderColor: 'divider',
            '&:hover': {
              backgroundColor: 'action.hover',
            },
          }}
        >
          <img
            src="/static/images/discord.svg"
            alt="Discord Logo"
            style={{ marginRight: '10px', height: '20px' }}
          />
          Sign in with Discord
        </Button>
      </>
    );
  }

  const renderInternalLoginSection = () =>
    (
      <>
        <CardContent style={{ position: 'relative' }}>
          <TextField
            fullWidth
            id="outlined-username-input"
            label="User Name"
            type="text"
            disabled={props.isLoading}
            autoComplete="current-username"
            onChange={handleUsernameChange}
          />
          {props.isLoading ? <CircularProgress color="inherit" className="spinner" /> : <></>}
        </CardContent>
        <CardContent>
          <TextField
            fullWidth
            id="outlined-password-input"
            label="Password"
            type="password"
            disabled={props.isLoading}
            autoComplete="current-password"
            onChange={handlePasswordChange}
          />
          <Typography 
            gutterBottom 
            variant="h5" 
            component="div" 
            sx={{ 
              color: 'error.main',
              fontSize: '0.8rem',
              marginTop: '0.5rem',
              marginBottom: '0.5rem',
            }}
          >
            {props.errorText}
          </Typography>
        </CardContent>
        <CardActions>
          <Button
            type="button"
            fullWidth
            variant="contained"
            color="primary"
            onClick={handleLogin}
            title="Login"
            sx={{ padding: '20px' }}
          >
            Login
          </Button>
        </CardActions>
        <Divider>OR</Divider>
      </>
    );

  return (
    <Box 
      sx={{ 
        width: '100vw',
        height: '100vh',
        backgroundColor: 'background.default',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'fixed',
        top: 0,
        left: 0,
      }}
    >
      <Box
        sx={{
          borderRadius: '16px',
          boxShadow: (theme) => `0 0 0 3px ${theme.palette.divider}, 0 2px 4px ${theme.palette.action.hover}`,
          padding: '20px',
          width: '340px',
          backgroundColor: 'background.paper',
          transform: 'scale(0.8)',
        }}
      >
        <form>
          <Card sx={{ 
            boxShadow: 'none',
            backgroundColor: 'background.paper',
          }}>
            <Card sx={{ 
              boxShadow: 'none',
              backgroundColor: 'background.paper',
            }}>
              <CardContent>
                <Box sx={{ margin: 0, padding: 0 }}>
                  <CardMedia 
                    sx={{ 
                      maxWidth: '300px',
                      margin: 0,
                      objectFit: 'fill',
                    }}
                    image="/static/images/logo.png" 
                    title="Soroban Security Portal" 
                    component="img" 
                  />
                </Box>
              </CardContent>
            </Card>
            {renderInternalLoginSection()}
            {renderSsoSection()}
          </Card>
        </form>
      </Box>
    </Box>
  );
};
