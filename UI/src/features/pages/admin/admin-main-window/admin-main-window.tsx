import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import MenuIcon from '@mui/icons-material/Menu';
import PersonIcon from '@mui/icons-material/Person';
import { Grid, Menu, MenuItem } from '@mui/material';
import MuiAppBar, { AppBarProps as MuiAppBarProps } from '@mui/material/AppBar';
import Box from '@mui/material/Box';
import CssBaseline from '@mui/material/CssBaseline';
import Drawer from '@mui/material/Drawer';
import IconButton from '@mui/material/IconButton';
import { styled } from '@mui/material/styles';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import { FC, MouseEvent, useState } from 'react';
import { useAuth } from 'react-oidc-context';
import { Route, Routes, useNavigate } from 'react-router-dom';
import { useAppSelector } from '../../../../app/hooks.ts';
import { AdminLeftMenu } from '../left-menu/admin-left-menu.tsx';
import { MyProfile } from '../my-profile/my-profile.tsx';
import { NoPage } from '../no-page/no-page.tsx';
import { Settings } from '../settings/settings.tsx';
import './admin-main-window.css';
import { AddUser } from '../users/add-item/add-user.tsx';
import { EditUser } from '../users/edit-item/edit-user.tsx';
import { UserManagement } from '../users/list-view/list-users.tsx';
import { selectCurrentPage } from './current-page-slice.ts';
import ErrorDialog from '../admin-main-window/error-dialog.tsx';
import { environment } from '../../../../environments/environment.ts';
import { VulnerabilityManagement } from '../vulnerabilities/list-view/list-vulnerabilities.tsx';
import { EditVulnerability } from '../vulnerabilities/edit-item/edit-vulnerability.tsx';
import { useTheme } from '../../../../contexts/ThemeContext';
import Brightness4Icon from '@mui/icons-material/Brightness4';
import Brightness7Icon from '@mui/icons-material/Brightness7';
import { ReportManagement } from '../reports/list-view/list-reports.tsx';
import { EditReport } from '../reports/edit-item/edit-report.tsx';
import { Subscriptions } from '../subscriptions/subscriptions.tsx';
import { EditAuditor } from '../auditor/edit-item/edit-auditor.tsx';
import { ListAuditors } from '../auditor/list-view/list-auditors.tsx';
import { AddAuditor } from '../auditor/add-item/add-auditor.tsx';
import { ListProjects } from '../project/list-view/list-projects.tsx';
import { AddProject } from '../project/add-item/add-project.tsx';
import { EditProject } from '../project/edit-item/edit-project.tsx';
import { ListCategories } from '../category/list-view/list-categories.tsx';
import { AddCategory } from '../category/add-item/add-category.tsx';
import { EditCategory } from '../category/edit-item/edit-category.tsx';

const drawerWidth = 240;
const drawerMarginLeft = 24;

interface AppBarProps extends MuiAppBarProps {
  leftMenuOpen: boolean;
}

const Main = styled('main', {
  shouldForwardProp: (prop) => prop !== 'leftMenuOpen',
})<AppBarProps>(({ theme, leftMenuOpen }) => ({
  flexGrow: 1,
  padding: theme.spacing(3),
  transition: theme.transitions.create('margin', {
    easing: theme.transitions.easing.sharp,
    duration: theme.transitions.duration.leavingScreen,
  }),
  ...(leftMenuOpen && {
    transition: theme.transitions.create('margin', {
      easing: theme.transitions.easing.easeOut,
      duration: theme.transitions.duration.enteringScreen,
    }),
    marginLeft: drawerWidth + drawerMarginLeft,
  }),
}));

const AppBar = styled(MuiAppBar, {
  shouldForwardProp: (prop) => prop !== 'leftMenuOpen',
})<AppBarProps>(({ theme, leftMenuOpen }) => ({
  transition: theme.transitions.create(['margin', 'width'], {
    easing: theme.transitions.easing.sharp,
    duration: theme.transitions.duration.leavingScreen,
  }),
  ...(leftMenuOpen && {
    width: `calc(100% - ${drawerWidth}px)`,
    marginLeft: `${drawerWidth + drawerMarginLeft}px`,
    transition: theme.transitions.create(['margin', 'width'], {
      easing: theme.transitions.easing.easeOut,
      duration: theme.transitions.duration.enteringScreen,
    }),
  }),
}));

const DrawerHeader = styled('div')(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  padding: theme.spacing(0, 1),
  // necessary for content to be below app bar
  ...theme.mixins.toolbar,
  justifyContent: 'flex-end',
}));

export const AdminMainWindow: FC = () => {
  const auth = useAuth();
  const { themeMode, toggleTheme } = useTheme();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [leftMenuOpen, setLeftMenuOpen] = useState(true);
  const open = Boolean(anchorEl);
  const currentPage = useAppSelector(selectCurrentPage);
  const navigate = useNavigate();

  const handleUserMenuClick = (event: MouseEvent<HTMLButtonElement>) =>
    setAnchorEl(anchorEl == null ? event.currentTarget : null);

  const handleUserMenuClose = () => setAnchorEl(null);

  const handleUserMenuItemProfileClick = () => {
    setAnchorEl(null);
    navigate('/admin/myprofile');
  };

  const handleUserMenuItemLogoutClick = () => {
    setAnchorEl(null);
    auth.signoutRedirect();
  };

  return (
    <Box sx={{ display: 'flex', position: 'relative', transform: `scale(${0.8})`, transformOrigin: 'top left', width: `125vw`, minHeight: `125vh`}}>
      <CssBaseline />
      <AppBar position="fixed" leftMenuOpen={leftMenuOpen}>
        <Toolbar>
          <IconButton
            color="inherit"
            aria-label="open drawer"
            edge="start"
            onClick={() => setLeftMenuOpen(true)}
            sx={{ mr: 2, ...(leftMenuOpen && { display: 'none' }) }}
          >
            <MenuIcon />
          </IconButton>
          <Grid container spacing={1} sx={{width: '100%'}}>
            <Grid>
              <Typography variant="h5" noWrap component="div">
                {currentPage.pageName}
              </Typography>
            </Grid>
          </Grid>
          {/* Theme Toggle Button */}
          <IconButton 
            color="inherit" 
            onClick={toggleTheme}
            sx={{ mr: 1 }}
          >
            {themeMode === 'dark' ? <Brightness7Icon /> : <Brightness4Icon />}
          </IconButton>
          <Typography noWrap component="div" sx={{ overflow: 'unset', marginRight: '20px' }}>
            {auth.user?.profile.name}
          </Typography>
          <IconButton color="inherit" aria-label="open drawer" edge="start" onClick={handleUserMenuClick}>
            {auth.user?.profile.picture ? (
              <Box
                component="img"
                src={auth.user.profile.picture}
                alt="Profile"
                sx={{
                  width: 34,
                  height: 34,
                  borderRadius: '50%',
                  objectFit: 'cover'
                }}
              />
            ) : (
              <PersonIcon />
            )}
            <Menu
              id="basic-menu"
              anchorEl={anchorEl}
              open={open}
              onClose={handleUserMenuClose}
              MenuListProps={{
                'aria-labelledby': 'basic-button',
              }}
            >
              <MenuItem onClick={handleUserMenuItemProfileClick}>My Profile</MenuItem>
              <MenuItem onClick={handleUserMenuItemLogoutClick}>Logout</MenuItem>
            </Menu>
          </IconButton>
        </Toolbar>
      </AppBar>
      <Box component="nav" aria-label="drawer container">
        <Drawer
          variant="persistent"
          sx={{
            display: 'block',
            '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth },
          }}
          anchor="left"
          open={leftMenuOpen}
        >
          <IconButton onClick={() => setLeftMenuOpen(false)} sx={{ width: 40, alignSelf: 'center' }}>
            <ChevronLeftIcon />
          </IconButton>
          <AdminLeftMenu />
        </Drawer>
      </Box>
      <Main leftMenuOpen={leftMenuOpen} className="mainWindowMain">
        <DrawerHeader />
        <Routes>
          <Route path={`${environment.basePath}/admin`} element={<VulnerabilityManagement />} />
          <Route path={`${environment.basePath}/admin/myprofile`} element={<MyProfile />} />

          <Route path={`${environment.basePath}/admin/settings`} element={<Settings />} />

          <Route path={`${environment.basePath}/admin/users`} element={<UserManagement />} />
          <Route path={`${environment.basePath}/admin/users/add`} element={<AddUser />} />
          <Route path={`${environment.basePath}/admin/users/edit`} element={<EditUser />} />

          <Route path={`${environment.basePath}/admin/vulnerabilities`} element={<VulnerabilityManagement />} />
          <Route path={`${environment.basePath}/admin/vulnerabilities/edit`} element={<EditVulnerability />} />

          <Route path={`${environment.basePath}/admin/reports`} element={<ReportManagement />} />
          <Route path={`${environment.basePath}/admin/reports/edit`} element={<EditReport />} />

          <Route path={`${environment.basePath}/admin/subscriptions`} element={<Subscriptions />} />

          
          <Route path={`${environment.basePath}/admin/auditors`} element={<ListAuditors />} />
          <Route path={`${environment.basePath}/admin/auditors/add`} element={<AddAuditor />} />
          <Route path={`${environment.basePath}/admin/auditors/edit`} element={<EditAuditor />} />

          <Route path={`${environment.basePath}/admin/projects`} element={<ListProjects />} />
          <Route path={`${environment.basePath}/admin/projects/add`} element={<AddProject />} />
          <Route path={`${environment.basePath}/admin/projects/edit`} element={<EditProject />} />

          <Route path={`${environment.basePath}/admin/categories`} element={<ListCategories />} />
          <Route path={`${environment.basePath}/admin/categories/add`} element={<AddCategory />} />
          <Route path={`${environment.basePath}/admin/categories/edit`} element={<EditCategory />} />

          <Route path={`${environment.basePath}/*`} element={<NoPage />} />
        </Routes>
        <ErrorDialog />
      </Main>
    </Box>
  );
};
