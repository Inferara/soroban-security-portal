import PeopleIcon from '@mui/icons-material/People';
import GavelIcon from '@mui/icons-material/Gavel';
import SettingsIcon from '@mui/icons-material/Settings';
import BugReportIcon from '@mui/icons-material/BugReport';
import BusinessIcon from '@mui/icons-material/Business';
import ReportIcon from '@mui/icons-material/Report';
import FormatListBulletedIcon from '@mui/icons-material/FormatListBulleted';
import MarkEmailReadIcon from '@mui/icons-material/MarkEmailRead';
import VerifiedUserIcon from '@mui/icons-material/VerifiedUser';
import TaskIcon from '@mui/icons-material/Task';
import QueryStatsIcon from '@mui/icons-material/QueryStats';
import Divider from '@mui/material/Divider';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import { useTheme } from '@mui/material/styles';
import { FC } from 'react';
import { useAuth } from 'react-oidc-context';
import './admin-left-menu.css';
import { environment } from '../../../../environments/environment';
import { useNavigate } from 'react-router-dom';
import { isAdmin, isAdminOrModerator } from '../../../authentication/authPermissions';

interface AdminLeftMenuProps {
  /** Callback when a menu item is clicked (for closing drawer on mobile) */
  onNavigate?: () => void;
}

export const AdminLeftMenu: FC<AdminLeftMenuProps> = ({ onNavigate }) => {
  const auth = useAuth();
  const navigate = useNavigate();
  const theme = useTheme();

  const navigateMenuItem = (path: string) => {
    navigate(`${environment.basePath}/${path}`);
    onNavigate?.(); // Close drawer on mobile
  };

  const menuStructure = [
    {
      label: 'Users',
      icon: <PeopleIcon />,
      path: 'admin/users',
      visible: isAdmin(auth),
    },
    {
      label: 'Moderation',
      icon: <GavelIcon />,
      path: 'admin/moderation',
      visible: isAdminOrModerator(auth),
    },
    {
      label: 'Statistics',
      icon: <QueryStatsIcon />,
      path: 'admin/statistics',
      visible: isAdminOrModerator(auth),
    },
    {
      label: 'General',
      icon: <SettingsIcon />,
      path: 'admin/settings',
      visible: isAdmin(auth),
    },
    {
      label: 'Vulnerabilities',
      icon: <BugReportIcon />,
      path: 'admin/vulnerabilities',
      visible: isAdminOrModerator(auth),
    },
    {
      label: 'Reports',
      icon: <ReportIcon />,
      path: 'admin/reports',
      visible: isAdminOrModerator(auth),
    },
    {
      label: 'Subscriptions',
      icon: <MarkEmailReadIcon />,
      path: 'admin/subscriptions',
      visible: isAdmin(auth),
    },
    {
      label: 'Auditors',
      icon: <VerifiedUserIcon />,
      path: 'admin/auditors',
      visible: isAdminOrModerator(auth),
    },
    {
      label: 'Companies',
      icon: <BusinessIcon />,
      path: 'admin/companies',
      visible: isAdminOrModerator(auth),
    },
    {
      label: 'Protocols',
      icon: <TaskIcon />,
      path: 'admin/protocols',
      visible: isAdminOrModerator(auth),
    },
    {
      label: 'Tags',
      icon: <FormatListBulletedIcon />,
      path: 'admin/tags',
      visible: isAdminOrModerator(auth),
    },
  ];

  const renderMenu = () => {
    let visibleMenuItemIndex = 0;
    return menuStructure.map((item, index) => {
      if (!item.visible) return null;
      visibleMenuItemIndex++;
      const menuItemColor = visibleMenuItemIndex % 2 === 0
        ? theme.palette.background.paper
        : theme.palette.action.hover;

      return (
        <ListItemButton onClick={() => navigateMenuItem(item.path)} key={index} sx={{ bgcolor: menuItemColor }}>
          <ListItemIcon>{item.icon}</ListItemIcon>
          <ListItemText primary={item.label} />
        </ListItemButton>);
    });
  }

  return (
    <>
      <div className="leftMenuTopSection">
        <img src="/static/images/logo.png" alt="Stellar Security Portal" className="leftMenuLogo" onClick={() => navigate('/')} style={{ cursor: 'pointer' }} />
      </div>
      <Divider />
      <List disablePadding component="nav">
        {renderMenu()}
      </List>
    </>
  );
};
