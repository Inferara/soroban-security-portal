import Box from '@mui/material/Box';
import { FC, MouseEvent, useState } from 'react';
import { Route, Routes, useNavigate, useLocation } from 'react-router-dom';
import './main-window.css';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import { useAuth } from 'react-oidc-context';
import IconButton from '@mui/material/IconButton';
import { Menu, MenuItem, Stack, TextField, Tooltip, Link as MuiLink } from '@mui/material';
import { environment } from '../../../../environments/environment';
import { Home } from '../home/home';
import { Reports } from '../reports/reports';
import { Vulnerabilities } from '../vulnerabilities/vulnerabilities';
import { AddVulnerability } from '../vulnerabilities-add/vulnerabilities-add';
import { AddReport } from '../reports-add/reports-add';
import { About } from '../about/about';
import { useTheme } from '../../../../contexts/ThemeContext';
import Brightness4Icon from '@mui/icons-material/Brightness4';
import Brightness7Icon from '@mui/icons-material/Brightness7';
import MailOutlineIcon from '@mui/icons-material/MailOutline';
import GitHubIcon from '@mui/icons-material/GitHub';
import TelegramIcon from '@mui/icons-material/Telegram';
import TwitterIcon from '@mui/icons-material/X';
import ChatIcon from '@mui/icons-material/Chat';
import { useMainWindow } from './hooks';
import ErrorDialog from '../../admin/admin-main-window/error-dialog';
import { Role } from '../../../../api/soroban-security-portal/models/role';

export const MainWindow: FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const auth = useAuth();
  const { themeMode, toggleTheme } = useTheme();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);
  const { email, setEmail, isSubscribing, handleSubscribe } = useMainWindow();

  const handleUserMenuClick = (event: MouseEvent<HTMLButtonElement>) =>
    setAnchorEl(anchorEl == null ? event.currentTarget : null);

  const handleUserMenuClose = () => setAnchorEl(null);

  const handleUserMenuItemLogoutClick = () => {
    setAnchorEl(null);
    auth.signoutRedirect();
  };

  const isActiveRoute = (path: string) => {
    return location.pathname === `${environment.basePath}${path}`;
  };

  let navigationItems = [
    { label: 'Home', path: '/' },
    { label: 'Reports', path: '/reports' },
    { label: 'Vulnerabilities', path: '/vulnerabilities' },
    { label: 'About', path: '/about' },
  ];
  if (auth.user?.profile.role === Role.Admin || auth.user?.profile.role === Role.Moderator) {
    navigationItems.push({ label: 'Admin', path: '/admin' });
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', bgcolor: 'background.default' }}>
      {/* Top AppBar */}
      <AppBar position="fixed" sx={{ 
        zIndex: (theme) => theme.zIndex.drawer + 1, 
        borderBottom: themeMode === 'light' ? '1px solid rgba(0, 0, 0, 0.12)' : '0px'
      }}>
        <Toolbar sx={{ bgcolor: 'background.paper', paddingTop: '10px' }}>
          <img src="/static/images/logo.png" alt="Logo" style={{ height: 70, marginRight: 6 }} />         
          {/* Navigation Buttons */}
          <Box sx={{ display: 'flex', ml: 4, gap: 1 }}>
            {navigationItems.map((item) => {
              const isActive = isActiveRoute(item.path);
              const fullPath = `${window.location.origin}${environment.basePath}${item.path}`;
              return (
                <MuiLink
                  key={item.path}
                  href={fullPath}
                  target="_blank"
                  rel="noopener noreferrer"
                  sx={{ textDecoration: 'none' }}
                  onClick={(event) => {
                    // If not Ctrl/Cmd click, prevent default and navigate normally
                    if (!event.ctrlKey && !event.metaKey) {
                      event.preventDefault();
                      navigate(item.path);
                    }
                  }}
                >
                  <Button
                    sx={{
                      color: isActive ? '#FFD84D' : '#DDCDB1',
                      height: '54px',
                      backgroundColor: 'transparent',
                      fontSize: isActive ? '1.5rem' : '1.2rem',
                      fontWeight: isActive ? 600 : 400,
                      textTransform: 'none',
                      '&:hover': {
                        backgroundColor: 'rgba(255, 216, 77, 0.1)',
                      },
                    }}
                  >
                    {item.label}
                  </Button>
                </MuiLink>
              );
            })}
          </Box>

          <Box sx={{ flexGrow: 1 }} />

          {/* Theme Toggle Button */}
            <IconButton 
              color="inherit" 
              onClick={toggleTheme}
              sx={{ mr: 1 }}
            >
              {themeMode === 'dark' ? <Brightness7Icon /> : <Brightness4Icon />}
            </IconButton>
          {
            auth.user 
              ? (
                <>
                  <Typography noWrap component="div" sx={{ overflow: 'unset', marginRight: '20px', fontSize: '1.2rem' }}>
                    {auth.user?.profile.name}
                  </Typography>
                  <IconButton color="inherit" aria-label="open drawer" edge="start" onClick={handleUserMenuClick}>
                    {auth.user?.profile.picture ? (
                      <Box
                        component="img"
                        src={auth.user.profile.picture}
                        alt="Profile"
                        sx={{
                          width: 44,
                          height: 44,
                          borderRadius: '50%',
                          objectFit: 'cover'
                        }}
                      />
                    ) : (
                      <Box
                        sx={{
                          width: 44,
                          height: 44,
                          borderRadius: '50%',
                          bgcolor: 'primary.main',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: 'white',
                          fontSize: '1.2rem',
                          fontWeight: 600,
                        }}
                      >
                        {auth.user?.profile.name?.charAt(0)?.toUpperCase() || 'U'}
                      </Box>
                    )}
                    <Menu
                      id="basic-menu"
                      anchorEl={anchorEl}
                      open={open}
                      onClose={handleUserMenuClose}
                      slotProps={{
                        list: {
                          'aria-labelledby': 'basic-button',
                        },
                      }}
                    >
                      <MenuItem onClick={handleUserMenuItemLogoutClick}>Logout</MenuItem>
                    </Menu>
                  </IconButton>
                </>
              )
              :
              (<Button
                color="primary"
                variant="contained"
                onClick={() => navigate('/login')}
                sx={{
                  ml: 2,
                  borderRadius: '6px',
                  fontWeight: 700,
                  boxShadow: '0 2px 8px 0 rgba(0,0,0,0.04)',
                  textTransform: 'none',
                  px: 3,
                  py: 1,
                  fontSize: '1rem',
                  background: 'linear-gradient(90deg, #4f8cff 0%, #3358e6 100%)',
                  '&:hover': {
                    background: 'linear-gradient(90deg, #3358e6 0%, #4f8cff 100%)',
                    boxShadow: '0 4px 16px 0 rgba(51,88,230,0.12)'
                  }
                }}
              >
                LOG IN
              </Button>)
          }
        </Toolbar>
      </AppBar>
      <Toolbar /> {/* Spacer for AppBar */}

      {/* Main content area */}
      <Box sx={{ flexGrow: 1, p: 0 }}>
        <Box sx={{ bgcolor: 'background.paper', borderRadius: 2, boxShadow: 1, p: 3, minHeight: '80vh' }}>
          <Routes>
            <Route path={`${environment.basePath}/`} element={<Home />} />
            <Route path={`${environment.basePath}/reports`} element={<Reports />} />
            <Route path={`${environment.basePath}/reports/add`} element={<AddReport />} />
            <Route path={`${environment.basePath}/vulnerabilities`} element={<Vulnerabilities />} />
            <Route path={`${environment.basePath}/vulnerabilities/add`} element={<AddVulnerability />} />
            <Route path={`${environment.basePath}/about`} element={<About />} />
          </Routes>
        </Box>
      </Box>

      {/* Footer */}
      <Box sx={{ backgroundColor: 'background.paper', color: 'secondary.main', p: 4, mt: 'auto' }}>
        <Stack direction="row" spacing={4} alignItems="flex-start" justifyContent="space-between">
          {/* Subscribe Section */}
          <Box sx={{ flex: 1 }}>
            <Typography variant="h6" fontWeight="bold" mb={2} color="secondary.main">
              Subscribe to updates
            </Typography>

            <Box
              component="form"
              onSubmit={handleSubscribe}
              sx={{
                display: 'flex',
                borderBottom: `1px solid ${themeMode === 'light' ? 'rgba(0, 0, 0, 0.12)' : 'rgba(255, 255, 255, 0.12)'}`,
                pb: 1,
                mb: 3,
              }}
            >
              <TextField
                variant="standard"
                placeholder="Your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isSubscribing}
                slotProps={{
                  input: {
                    disableUnderline: true,
                    sx: { color: 'secondary.main', backgroundColor: 'transparent' },
                  }
                }}
                fullWidth
              />
              <Button
                type="submit"
                disabled={isSubscribing}
                sx={{
                  color: 'secondary.main',
                  fontWeight: 'bold',
                  backgroundColor: 'transparent',
                  textTransform: 'none',
                  '&:hover': {
                    backgroundColor: 'rgba(255, 216, 77, 0.1)',
                  },
                  '&:disabled': {
                    color: 'rgba(255, 255, 255, 0.38)',
                  }
                }}
              >
                {isSubscribing ? 'Subscribing...' : 'Subscribe'}
              </Button>
            </Box>
          </Box>

          {/* Social Icons Section */}
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <Typography variant="h6" fontWeight="bold" mb={2} color="secondary.main">
              &nbsp;
            </Typography>
            <Stack direction="row" spacing={2}>
              <Tooltip title="Contact us via email" arrow>
                <IconButton
                  sx={{ color: 'secondary.main' }}
                  aria-label="email"
                  component="a"
                  href="mailto:info@inferara.com"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <MailOutlineIcon />
                </IconButton>
              </Tooltip>
              <Tooltip title="Follow us on X (Twitter)" arrow>
                <IconButton
                  sx={{ color: 'secondary.main' }}
                  aria-label="x-twitter"
                  component="a"
                  href="https://www.x.com/Inferara_kk"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <TwitterIcon />
                </IconButton>
              </Tooltip>
              <Tooltip title="Join our Discord community" arrow>
                <IconButton
                  sx={{ color: 'secondary.main' }}
                  aria-label="discord"
                  component="a"
                  href="https://discord.gg/NgWfmnmS5C"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ChatIcon />
                </IconButton>
              </Tooltip>
              <Tooltip title="Check out our GitHub" arrow>
                <IconButton
                  sx={{ color: 'secondary.main' }}
                  aria-label="github"
                  component="a"
                  href="https://www.github.com/inferara/soroban-security-portal"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <GitHubIcon />
                </IconButton>
              </Tooltip>
              <Tooltip title="Join our Telegram channel" arrow>
                <IconButton
                  sx={{ color: 'secondary.main' }}
                  aria-label="telegram"
                  component="a"
                  href="https://t.me/inferara"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <TelegramIcon />
                </IconButton>
              </Tooltip>
            </Stack>
          </Box>
        </Stack>

        <Typography variant="body2" align="center" sx={{ color: 'secondary.main', mt: 3 }}>
          Made by{' '}
          <Typography
            component="a"
            href="https://inferara.com"
            target="_blank"
            rel="noopener noreferrer"
            sx={{ color: 'inherit', textDecoration: 'underline', display: 'inline' }}
          >
            Inferara
          </Typography>
        </Typography>
      </Box>
      <ErrorDialog />
    </Box>
  );
};
