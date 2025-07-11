import PersonAddIcon from '@mui/icons-material/PersonAdd';
import ClearIcon from '@mui/icons-material/Clear';
import {
  IconButton,
  Link,
  Stack,
  Switch,
  Tooltip,
} from '@mui/material';
import {
  DataGrid,
  GridColDef,
  GridRenderCellParams,
} from '@mui/x-data-grid';
import { FC, useState } from 'react';

import { UserItem } from '../../../../../api/soroban-security-portal/models/user.ts';
import { CurrentPageState } from '../../admin-main-window/current-page-slice.ts';
import { useListUsers } from './hooks';
import { ConfirmDialog } from '../../admin-main-window/confirm-dialog.tsx';
import { CustomToolbar } from '../../../../components/custom-toolbar.tsx';
import { useNavigate } from 'react-router-dom';
import { defaultUiSettings } from '../../../../../api/soroban-security-portal/models/ui-settings.ts';

export const UserManagement: FC = () => {
  const navigate = useNavigate();

  const currentPageState: CurrentPageState = {
    pageName: 'Users',
    pageCode: 'users',
    pageUrl: window.location.pathname,
    routePath: 'admin/users',
  };

  const { userListData, userEnabledChange, userRemove } = useListUsers({ currentPageState });
  const [loginIdToRemove, setLoginIdToRemove] = useState(0);

  const removeLoginConfirmed = async () => {
    await userRemove(loginIdToRemove);
    setLoginIdToRemove(0);
  };

  const columnsData: GridColDef[] = [
    {
      field: 'actions',
      headerName: 'Actions',
      width: 80,
      sortable: false,
      filterable: false,
      renderCell: (params: GridRenderCellParams<UserItem>) => (
        <Tooltip title="Remove User">
          <IconButton onClick={() => setLoginIdToRemove(params.row.loginId)}>
            <ClearIcon sx={{ color: 'red' }} />
          </IconButton>
        </Tooltip>
      ),
    } as GridColDef,
    {
      field: 'isEnabled',
      headerName: 'Enabled',
      width: 80,
      renderCell: (params: GridRenderCellParams<UserItem>) => (
        <Switch
          checked={params.row.isEnabled}
          onChange={(e) =>
            userEnabledChange(params.row.loginId, e.target.checked)
          }
          inputProps={{ 'aria-label': 'Enable toggle' }}
        />
      ),
    } as GridColDef,
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
          onClick={() =>
            navigate(`/admin/users/edit?loginId=${params.row.loginId}`)
          }
        >
          {params.row.fullName}
        </Link>
      ),
    } as GridColDef,
    {
      field: 'login',
      headerName: 'Login',
      width: 250,
    } as GridColDef,
    {
      field: 'loginType',
      headerName: 'Login Type',
      width: 120,
    } as GridColDef,
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
    } as GridColDef,
    {
      field: 'role',
      headerName: 'Role',
      width: 150,
    } as GridColDef,
  ];

  return (
    <div style={defaultUiSettings.listAreaStyle}>
      <Stack direction="row" spacing={2}>
        <Tooltip title="Add User">
          <IconButton onClick={() => navigate('/admin/users/add')}>
            <PersonAddIcon sx={{ color: 'green' }} />
          </IconButton>
        </Tooltip>
      </Stack>

      <div style={{ height: 'calc(110vh - 64px)' }}>
        <DataGrid
          getRowId={(row: UserItem) => row.loginId}
          getRowHeight={() => 'auto'}
          sx={{
            '& .MuiDataGrid-cell': {
              whiteSpace: 'normal',
              display: 'grid',
              alignContent: 'center',
              minHeight: 50,
            },
          }}
          rows={userListData}
          columns={columnsData}
          showToolbar={true}
          slots={{
            toolbar: CustomToolbar,
          }}
          isRowSelectable={() => false}
        />
      </div>

      <ConfirmDialog
        title="Remove User"
        message="Are you sure you want to remove this User?"
        okButtonText="Yes"
        cancelButtonText="No"
        onConfirm={removeLoginConfirmed}
        onCancel={() => setLoginIdToRemove(0)}
        show={loginIdToRemove !== 0}
      />
    </div>
  );
};
