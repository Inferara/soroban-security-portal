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
  Menu,
  MenuItem,
  Stack,
  TextField,
  Tooltip,
  Link as MuiLink,
  Drawer,
  List,
  ListItemButton,
  ListItemText,
  Divider,
  CircularProgress,
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
import { PublicProfile } from '../profile/public-profile';
import { VulnerabilityDetails } from '../vulnerability-details/vulnerability-details';
import { ProtocolDetails } from '../protocol-details/protocol-details';
import { ReportDetails } from '../report-details/report-details';
import { AuditorDetails } from '../auditor-details/auditor-details';
import { CompanyDetails } from '../company-details/company-details';
import { BadgeDemoPage } from '../../BadgeDemoPage';
import { useTheme } from '../../../../contexts/ThemeContext';
import { useToolbarAvatar } from '../../../../hooks/useToolbarAvatar';
import { getUserInitials } from '../../../../utils/user-utils';
import Brightness4Icon from '@mui/icons-material/Brightness4';
import Brightness7Icon from '@mui/icons-material/Brightness7';
import MailOutlinedIcon from '@mui/icons-material/MailOutlined';
import GitHubIcon from '@mui/icons-material/GitHub';
import TelegramIcon from '@mui/icons-material/Telegram';
import TwitterIcon from '@mui/icons-material/X';
import ChatIcon from '@mui/icons-material/Chat';
import { useMainWindow } from './hooks';
import { useBookmarks } from '../../../../contexts/BookmarkContext';
import ErrorDialog from '../../admin/admin-main-window/error-dialog';
import { BookmarkMenu } from './components/BookmarkMenu';
import { NotificationBell } from '../../../notifications/NotificationBell';
import { MentionsInbox } from '../../../notifications/MentionsInbox';
import { StyledAvatar } from '../../../../components/common/StyledAvatar';
import { AccentColors } from '../../../../theme';
import { isAdminOrModerator } from '../../../authentication/authPermissions';

export const MainWindow: FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const auth = useAuth();
  const { themeMode, toggleTheme, tokens } = useTheme();

  // user menu
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);

  // mobile drawer
  const [mobileOpen, setMobileOpen] = useState(false);
  const toggleMobile = () => setMobileOpen((prev) => !prev);

  // avatar state from shared hook
  const { avatarUrl, avatarLoading, avatarError, handleAvatarLoad, handleAvatarError } = useToolbarAvatar();

  const { email, setEmail, isSubscribing, handleSubscribe } = useMainWindow();
  const { bookmarks } = useBookmarks();

  const handleUserMenuClick = (event: MouseEvent<HTMLButtonElement>) =>
    setAnchorEl(anchorEl == null ? event.currentTarget : null);

  const handleUserMenuClose = () => setAnchorEl(null);

  const handleUserMenuItemLogoutClick = async () => {
    setAnchorEl(null);
    const oidcUserKey = `oidc.user:${environment.apiUrl}/api/v1/connect:${environment.clientId}`;
    localStorage.removeItem(oidcUserKey);
    await auth.removeUser();
  };

  const isActiveRoute = (path: string) => {
    return location.pathname === `${environment.basePath}${path}`;
  };

  // The home page renders full-bleed (no contrasting card frame) so its cosmic
  // background blends seamlessly with the header and footer.
  const isHomeRoute =
    isActiveRoute('/') || location.pathname === '/' || location.pathname.endsWith('/home');

  const baseNavigationItems = [
    { label: 'Home', path: '/' },
    { label: 'Reports', path: '/reports' },
    { label: 'Vulnerabilities', path: '/vulnerabilities' },
    { label: 'About', path: '/about' },
  ];
  const isAdminUser = isAdminOrModerator(auth);
  const navigationItems = isAdminUser
    ? [...baseNavigationItems, { label: 'Admin', path: '/admin' }]
    : baseNavigationItems;

  const navButtons = navigationItems.map((item) => {
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
            color: isActive ? AccentColors.navigationActive : AccentColors.navigationInactive,
            height: '54px',
            backgroundColor: 'transparent',
            fontSize: isActive ? '1.5rem' : '1.2rem',
            fontWeight: isActive ? 600 : 400,
            textTransform: 'none',
            position: 'relative',
            transition: 'color .2s ease',
            '&:hover': { backgroundColor: 'rgba(255, 216, 77, 0.1)', color: AccentColors.navigationActive },
            '&::after': isActive
              ? {
                  content: '""',
                  position: 'absolute',
                  left: '12%',
                  right: '12%',
                  bottom: 6,
                  height: 2,
                  background: AccentColors.navigationActive,
                  boxShadow: `0 0 8px ${AccentColors.navigationActive}`,
                  borderRadius: 2,
                }
              : undefined,
          }}
          fullWidth
        >
          {item.label}
        </Button>
      </MuiLink>
    );
  });

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', bgcolor: 'background.default' }}>
      {/* Top AppBar */}
      <AppBar
        position="fixed"
        sx={{
          zIndex: (theme) => theme.zIndex.drawer + 1,
          borderBottom: themeMode === 'light' ? '1px solid rgba(0, 0, 0, 0.12)' : '0px',
        }}
      >
        <Toolbar sx={{ bgcolor: 'background.paper', py: { xs: 0.5, md: 1.25 } }}>
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
              component="span"
              sx={{
                display: { xs: 'none', sm: 'flex' },
                alignItems: 'baseline',
                gap: '0.35ch',
                fontSize: '1.3rem',
                letterSpacing: '-0.01em',
                lineHeight: 1,
                whiteSpace: 'nowrap',
              }}
            >
              <Box
                component="span"
                sx={{
                  fontWeight: 800,
                  backgroundImage: tokens.goldGradient,
                  WebkitBackgroundClip: 'text',
                  backgroundClip: 'text',
                  color: 'transparent',
                }}
              >
                Stellar
              </Box>
              <Box component="span" sx={{ fontWeight: 600, color: 'text.primary' }}>
                Security Portal
              </Box>
            </Typography>
          </Box>

          {/* Desktop navigation */}
          <Box sx={{ display: { xs: 'none', md: 'flex' }, ml: 4, gap: 1 }}>{navButtons}</Box>

          <Box sx={{ flexGrow: 1 }} />

          {/* Hamburger on mobile */}
          <IconButton
            aria-label="open navigation"
            onClick={toggleMobile}
            sx={{ display: { xs: 'inline-flex', md: 'none' }, ml: 1 }}
            edge="end"
          >
            <MenuIcon />
          </IconButton>

          {/* Theme Toggle */}
          <Tooltip title={themeMode === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'} arrow>
            <IconButton
              color="inherit"
              aria-label="toggle light/dark theme"
              onClick={toggleTheme}
              sx={{ mr: 1 }}
            >
              {themeMode === 'dark' ? <Brightness7Icon /> : <Brightness4Icon />}
            </IconButton>
          </Tooltip>

          {/* Right: Profile/Login */}
          {auth.isAuthenticated && auth.user ? (
            <>
              <Typography
                noWrap
                component="div"
                sx={{ display: { xs: 'block', sm: 'block' }, mr: 2, fontSize: '1.2rem' }}
              >
                {auth.user?.profile.name}
              </Typography>
              <IconButton color="inherit" aria-label="open user menu" edge="end" onClick={handleUserMenuClick}>
                {avatarUrl && !avatarError ? (
                  <Box sx={{ position: 'relative', width: 44, height: 44 }}>
                    {avatarLoading && (
                      <CircularProgress
                        size={30}
                        sx={{
                          position: 'absolute',
                          top: '50%',
                          left: '50%',
                          marginTop: '-15px',
                          marginLeft: '-15px',
                          color: AccentColors.loadingIndicator,
                        }}
                      />
                    )}
                    <Box
                      component="img"
                      src={avatarUrl}
                      alt="Profile"
                      sx={{
                        width: 44,
                        height: 44,
                        borderRadius: '50%',
                        objectFit: 'cover',
                        opacity: avatarLoading ? 0 : 1,
                        transition: 'opacity 0.2s ease-in-out',
                      }}
                      onLoad={handleAvatarLoad}
                      onError={handleAvatarError}
                    />
                  </Box>
                ) : avatarLoading ? (
                  <StyledAvatar>
                    <CircularProgress size={24} sx={{ color: AccentColors.loadingIndicator }} />
                  </StyledAvatar>
                ) : (
                  <StyledAvatar>{getUserInitials(auth.user?.profile.name || 'User Name')}</StyledAvatar>
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
              {!auth.isLoading && <NotificationBell />}
              {!auth.isLoading && <BookmarkMenu bookmarks={bookmarks} />}
            </>
          ) : (
            <Button
              color="primary"
              variant="contained"
              onClick={() => navigate('/login')}
              sx={{ ml: 2, textTransform: 'uppercase', px: 3, py: 1, display: { xs: 'none', md: 'inline-flex' } }}
            >
              Log In
            </Button>
          )}
        </Toolbar>
      </AppBar>
      {/* Mobile Drawer */}
      <Drawer
        anchor="right"
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        ModalProps={{ keepMounted: true }}
        slotProps={{ paper: { sx: { width: 300 } } }}
      >
        <Box role="presentation" sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', p: 2 }}>
            <Box component="img" src="/static/images/logo.png" alt="Logo" sx={{ height: 40, mr: 1 }} />
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              Menu
            </Typography>
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
                        sx: { fontWeight: isActive ? 700 : 500 },
                      },
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
                onClick={() => {
                  navigate('/profile');
                  setMobileOpen(false);
                }}
              >
                My Profile
              </Button>
            ) : (
              <Button
                fullWidth
                variant="contained"
                onClick={() => {
                  navigate('/login');
                  setMobileOpen(false);
                }}
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
        <Box
          sx={
            isHomeRoute
              ? { bgcolor: 'transparent', borderRadius: 0, boxShadow: 0, p: 0, minHeight: '91vh' }
              : { bgcolor: 'background.paper', borderRadius: 2, boxShadow: 1, p: { xs: 2, md: 3 }, minHeight: '91vh' }
          }
        >
          <Routes>
            <Route path={`${environment.basePath}/`} element={<Home />} />
            <Route path={`${environment.basePath}/reports`} element={<Reports />} />
            <Route path={`${environment.basePath}/reports/add`} element={<AddReport />} />
            <Route path={`${environment.basePath}/vulnerabilities`} element={<Vulnerabilities />} />
            <Route path={`${environment.basePath}/vulnerabilities/add`} element={<AddVulnerability />} />
            <Route path={`${environment.basePath}/about`} element={<About />} />
            <Route path={`${environment.basePath}/profile`} element={<Profile />} />
            <Route path={`${environment.basePath}/profile/edit`} element={<EditProfile />} />
            <Route path={`${environment.basePath}/profile/:id`} element={<PublicProfile />} />
            <Route path={`${environment.basePath}/vulnerability/:id`} element={<VulnerabilityDetails />} />
            <Route path={`${environment.basePath}/protocol/:id`} element={<ProtocolDetails />} />
            <Route path={`${environment.basePath}/report/:id`} element={<ReportDetails />} />
            <Route path={`${environment.basePath}/auditor/:id`} element={<AuditorDetails />} />
            <Route path={`${environment.basePath}/company/:id`} element={<CompanyDetails />} />
            <Route path={`${environment.basePath}/badge-demo`} element={<BadgeDemoPage />} />
            <Route path={`${environment.basePath}/mentions`} element={<MentionsInbox />} />
          </Routes>
        </Box>
      </Box>
      {/* Footer */}
      {(location.pathname.endsWith('home') || location.pathname === '/' || location.pathname.endsWith('about')) && (
        <Box sx={{ backgroundColor: 'background.paper', backgroundImage: tokens.sectionGradient, borderTop: '1px solid', borderColor: 'divider', color: 'secondary.main', p: { xs: 2.5, md: 4 }, mt: 'auto' }}>
          <Stack
            direction={{ xs: 'column', md: 'row' }}
            spacing={{ xs: 3, md: 4 }}
            sx={{ alignItems: { xs: 'stretch', md: 'flex-start' }, justifyContent: 'space-between' }}
          >
            {/* Subscribe Section */}
            <Box sx={{ flex: 1 }}>
              <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 2, color: 'secondary.main' }}>
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
                  flexWrap: { xs: 'wrap', sm: 'nowrap' },
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
                    },
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
                    '&:disabled': { color: 'rgba(255, 255, 255, 0.38)' },
                  }}
                >
                  {isSubscribing ? 'Subscribing...' : 'Subscribe'}
                </Button>
              </Box>
            </Box>

            {/* Social Icons Section */}
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: { xs: 'flex-start', md: 'center' },
                '& .MuiButtonBase-root': {
                  transition: 'color .2s ease, filter .2s ease, transform .2s ease',
                  '&:hover': {
                    color: '#FFD84D',
                    filter: 'drop-shadow(0 0 6px rgba(255,216,77,0.6))',
                    transform: 'translateY(-2px)',
                  },
                },
              }}
            >
              <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 2, color: 'secondary.main' }}>
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
                    <MailOutlinedIcon />
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

