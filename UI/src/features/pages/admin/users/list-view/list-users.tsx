import PersonAddIcon from '@mui/icons-material/PersonAdd';
import { Link, Switch } from '@mui/material';
import { GridColDef, GridRenderCellParams } from '@mui/x-data-grid';
import { FC, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

import { UserItem } from '../../../../../api/soroban-security-portal/models/user';
import { AdminDataGrid } from '../../../../../components/admin';
import { useListUsers } from './hooks';
import { CurrentPageState } from '../../admin-main-window/current-page-slice';

export const UserManagement: FC = () => {
  const navigate = useNavigate();

  const currentPageState: CurrentPageState = useMemo(() => ({
    pageName: 'Users',
    pageCode: 'users',
    pageUrl: window.location.pathname,
    routePath: 'admin/users',
  }), []);

  const { userListData, userEnabledChange, userRemove } = useListUsers({ currentPageState });

  const columnsData: GridColDef[] = useMemo(() => [
    {
      field: 'isEnabled',
      headerName: 'Enabled',
      width: 80,
      renderCell: (params: GridRenderCellParams<UserItem>) => (
        <Switch
          checked={params.row.isEnabled}
          onChange={(e) => userEnabledChange(params.row.loginId, e.target.checked)}
          inputProps={{ 'aria-label': 'Enable toggle' }}
        />
      ),
    },
    {
      field: 'fullName',
      headerName: 'Full Name',
      width: 250,
      renderCell: (params: GridRenderCellParams<UserItem>) => (
        <Link
          sx={{
            textAlign: 'left',
            textOverflow: 'ellipsis',
            overflow: 'hidden',
            whiteSpace: 'nowrap',
          }}
          component="button"
          onClick={() => navigate(`/admin/users/edit?loginId=${params.row.loginId}`)}
        >
          {params.row.fullName}
        </Link>
      ),
    },
    {
      field: 'login',
      headerName: 'Login',
      width: 250,
    },
    {
      field: 'loginType',
      headerName: 'Login Type',
      width: 120,
    },
    {
      field: 'email',
      headerName: 'Email',
      width: 250,
      renderCell: (params: GridRenderCellParams<UserItem>) => (
        <Link
          sx={{
            textAlign: 'left',
            textOverflow: 'ellipsis',
            overflow: 'hidden',
            whiteSpace: 'nowrap',
          }}
          href={`mailto:${params.row.email}`}
          target="_top"
          rel="noopener"
        >
          {params.row.email}
        </Link>
      ),
    },
    {
      field: 'role',
      headerName: 'Role',
      width: 150,
    },
  ], [navigate, userEnabledChange]);

  return (
    <AdminDataGrid<UserItem>
      rows={userListData}
      columns={columnsData}
      getRowId={(row) => row.loginId}
      onRemove={userRemove}
      addButton={{
        path: '/admin/users/add',
        icon: <PersonAddIcon sx={{ color: 'green' }} />,
        tooltip: 'Add User',
      }}
      removeAction={{
        tooltip: 'Remove User',
        getRowId: (row) => row.loginId,
        adminOnly: false, // Users page always shows remove for the admin viewing it
      }}
      confirmDialog={{
        title: 'Remove User',
        message: 'Are you sure you want to remove this User?',
      }}
    />
  );
};
