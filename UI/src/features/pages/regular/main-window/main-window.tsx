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
import {
  Menu, MenuItem, Stack, TextField, Tooltip, Link as MuiLink, styled, Avatar,
  Drawer, List, ListItemButton, ListItemText, Divider
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import { environment } from '../../../../environments/environment';
import { Home } from '../home/home';
import { Reports } from '../reports/reports';
import { Vulnerabilities } from '../vulnerabilities/vulnerabilities';
import { AddVulnerability } from '../vulnerabilities-add/vulnerabilities-add';
import { AddReport } from '../reports-add/reports-add';
import { About } from '../about/about';
import { Profile } from '../profile/profile';
import { EditProfile } from '../profile/edit-profile';
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

const StyledAvatar = styled(Avatar)(() => ({
  width: 40,
  height: 40,
  backgroundColor: '#9386b6',
  border: '3px solid #FCD34D',
  fontSize: '18px',
  fontWeight: 'bold',
}));

export const MainWindow: FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const auth = useAuth();
  const { themeMode, toggleTheme } = useTheme();

  // user menu
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);

  // mobile drawer
  const [mobileOpen, setMobileOpen] = useState(false);
  const toggleMobile  = () => setMobileOpen(prev => !prev);

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

  const getUserInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
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

  const NavButtons = () => (
    <>
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
              if (!event.ctrlKey && !event.metaKey) {
                event.preventDefault();
                navigate(item.path);
                setMobileOpen(false);
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
                '&:hover': { backgroundColor: 'rgba(255, 216, 77, 0.1)' },
              }}
              fullWidth
            >
              {item.label}
            </Button>
          </MuiLink>
        );
      })}
    </>
  );

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', bgcolor: 'background.default' }}>
      {/* Top AppBar */}
      <AppBar
        position="fixed"
        sx={{
          zIndex: (theme) => theme.zIndex.drawer + 1,
          borderBottom: themeMode === 'light' ? '1px solid rgba(0, 0, 0, 0.12)' : '0px'
        }}
      >
        <Toolbar sx={{ bgcolor: 'background.paper', py: { xs: 0.5, md: 1.25 } }}>
          {/* Hamburger on mobile */}
          <IconButton
            aria-label="open navigation"
            onClick={toggleMobile}
            sx={{ display: { xs: 'inline-flex', md: 'none' }, mr: 1 }}
            edge="start"
          >
            <MenuIcon />
          </IconButton>

          {/* Logo */}
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <Box
              component="img"
              src="/static/images/logo.png"
              alt="Logo"
              sx={{ height: { xs: 44, sm: 56, md: 70 }, mr: { xs: 1, md: 2 } }}
            />
            <Typography
              variant="h6"
              sx={{ display: { xs: 'none', sm: 'block' }, fontWeight: 700 }}
            >
              {/* Optional brand text if you want */}
            </Typography>
          </Box>

          {/* Desktop navigation */}
          <Box sx={{ display: { xs: 'none', md: 'flex' }, ml: 4, gap: 1 }}>
            <NavButtons />
          </Box>

          <Box sx={{ flexGrow: 1 }} />

          {/* Theme Toggle (currently hidden per your code) */}
          <IconButton
            color="inherit"
            onClick={toggleTheme}
            sx={{ mr: 1, visibility: 'hidden' }}  // keep your hidden behavior
          >
            {themeMode === 'dark' ? <Brightness7Icon /> : <Brightness4Icon />}
          </IconButton>

          {/* Right: Profile/Login */}
          {auth.user ? (
            <>
              <Typography noWrap component="div" sx={{ display: { xs: 'block', sm: 'block' }, mr: 2, fontSize: '1.2rem' }}>
                {auth.user?.profile.name}
              </Typography>
              <IconButton color="inherit" aria-label="open user menu" edge="end" onClick={handleUserMenuClick}>
                {auth.user?.profile.picture ? (
                  <Box
                    component="img"
                    src={`${environment.apiUrl}${auth.user.profile.picture}`}
                    alt="Profile"
                    sx={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover' }}
                  />
                ) : (
                  <StyledAvatar>
                    {getUserInitials(auth.user?.profile.name || 'User Name')}
                  </StyledAvatar>
                )}
              </IconButton>

              <Menu
                id="user-menu"
                anchorEl={anchorEl}
                open={open}
                onClose={handleUserMenuClose}
                slotProps={{ list: { 'aria-labelledby': 'user-menu-button' } }}
              >
                <MenuItem onClick={() => navigate('/profile')}>My Profile</MenuItem>
                <MenuItem onClick={handleUserMenuItemLogoutClick}>Log out</MenuItem>
              </Menu>
            </>
          ) : (
            <Button
              color="primary"
              variant="contained"
              onClick={() => navigate('/login')}
              sx={{ ml: 2, borderRadius: '6px', textTransform: 'uppercase', px: 3, py: 1,  display: { xs: 'none', md: 'inline-flex' } }}
            >
              Log In
            </Button>
          )}
        </Toolbar>
      </AppBar>

      {/* Mobile Drawer */}
      <Drawer
        anchor="left"
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        ModalProps={{ keepMounted: true }}
        slotProps={{ paper: { sx: { width: 300 } } }}
      >
        <Box role="presentation" sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', p: 2 }}>
            <Box component="img" src="/static/images/logo.png" alt="Logo" sx={{ height: 40, mr: 1 }} />
            <Typography variant="h6" fontWeight={700}>Menu</Typography>
          </Box>
          <Divider />
          <List sx={{ py: 0 }}>
            {navigationItems.map((item) => {
              const isActive = isActiveRoute(item.path);
              const fullPath = `${window.location.origin}${environment.basePath}${item.path}`;
              return (
                <ListItemButton
                  key={item.path}
                  selected={isActive}
                  onClick={(e) => {
                    const evt = e as unknown as MouseEvent & { ctrlKey?: boolean; metaKey?: boolean };
                    if (evt.ctrlKey || evt.metaKey) {
                      window.open(fullPath, '_blank', 'noopener,noreferrer');
                    } else {
                      navigate(item.path);
                    }
                    setMobileOpen(false);
                  }}
                >
                  <ListItemText
                    primary={item.label}
                    slotProps={{
                      primary: {
                        fontWeight: isActive ? 700 : 500
                      }
                    }}
                  />
                </ListItemButton>
              );
            })}
          </List>
          <Divider sx={{ mt: 'auto' }} />
          <Box sx={{ p: 2 }}>
            {auth.user ? (
              <Button
                fullWidth
                variant="outlined"
                onClick={() => { navigate('/profile'); setMobileOpen(false); }}
              >
                My Profile
              </Button>
            ) : (
              <Button
                fullWidth
                variant="contained"
                onClick={() => { navigate('/login'); setMobileOpen(false); }}
              >
                Log In
              </Button>
            )}
          </Box>
        </Box>
      </Drawer>

      <Toolbar /> {/* Spacer for AppBar */}

      {/* Main content area */}
      <Box sx={{ flexGrow: 1, p: 0 }}>
        <Box sx={{ bgcolor: 'background.paper', borderRadius: 2, boxShadow: 1, p: { xs: 2, md: 3 }, minHeight: '91vh' }}>
          <Routes>
            <Route path={`${environment.basePath}/`} element={<Home />} />
            <Route path={`${environment.basePath}/reports`} element={<Reports />} />
            <Route path={`${environment.basePath}/reports/add`} element={<AddReport />} />
            <Route path={`${environment.basePath}/vulnerabilities`} element={<Vulnerabilities />} />
            <Route path={`${environment.basePath}/vulnerabilities/add`} element={<AddVulnerability />} />
            <Route path={`${environment.basePath}/about`} element={<About />} />
            <Route path={`${environment.basePath}/profile`} element={<Profile />} />
            <Route path={`${environment.basePath}/profile/edit`} element={<EditProfile />} />
          </Routes>
        </Box>
      </Box>

      {/* Footer */}
      {(location.pathname.endsWith('home') || location.pathname === '/' || location.pathname.endsWith('about')) && (
        <Box sx={{ backgroundColor: 'background.paper', color: 'secondary.main', p: { xs: 2.5, md: 4 }, mt: 'auto' }}>
          <Stack
            direction={{ xs: 'column', md: 'row' }}
            spacing={{ xs: 3, md: 4 }}
            alignItems={{ xs: 'stretch', md: 'flex-start' }}
            justifyContent="space-between"
          >
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
                  gap: 1,
                  flexWrap: { xs: 'wrap', sm: 'nowrap' }
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
                    '&:hover': { backgroundColor: 'rgba(255, 216, 77, 0.1)' },
                    '&:disabled': { color: 'rgba(255, 255, 255, 0.38)' }
                  }}
                >
                  {isSubscribing ? 'Subscribing...' : 'Subscribe'}
                </Button>
              </Box>
            </Box>

            {/* Social Icons Section */}
            <Box sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: { xs: 'flex-start', md: 'center' },
              '& .MuiButtonBase-root': { '&:hover': { color: '#2D4EFF' } }
            }}>
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
      )}
      <ErrorDialog />
    </Box>
  );
};
