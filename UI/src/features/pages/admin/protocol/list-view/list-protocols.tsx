import ClearIcon from '@mui/icons-material/Clear';
import {
  IconButton,
  Link,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  DataGrid,
  GridColDef,
  GridRenderCellParams,
} from '@mui/x-data-grid';
import { FC, useState } from 'react';

import { ProtocolItem } from '../../../../../api/soroban-security-portal/models/protocol.ts';
import { CurrentPageState } from '../../admin-main-window/current-page-slice.ts';
import { useListProtocols } from './hooks/index.ts';
import { ConfirmDialog } from '../../admin-main-window/confirm-dialog.tsx';
import { CustomToolbar } from '../../../../components/custom-toolbar.tsx';
import { useNavigate } from 'react-router-dom';
import { defaultUiSettings } from '../../../../../api/soroban-security-portal/models/ui-settings.ts';
import { AuthContextProps, useAuth } from 'react-oidc-context';
import { Role } from '../../../../../api/soroban-security-portal/models/role.ts';
import AddToQueueIcon from '@mui/icons-material/AddToQueue';

export const ListProtocols: FC = () => {
  const auth = useAuth();
  const navigate = useNavigate();

  const isAdmin = (auth: AuthContextProps) => auth.user?.profile.role === Role.Admin;

  const currentPageState: CurrentPageState = {
    pageName: 'Protocols',
    pageCode: 'protocols',
    pageUrl: window.location.pathname,
    routePath: 'admin/protocols',
  };

  const { protocolListData, protocolRemove, companyListData } = useListProtocols({ currentPageState });
  const [protocolIdToRemove, setProtocolIdToRemove] = useState(0);

  const removeProtocolConfirmed = async () => {
    await protocolRemove(protocolIdToRemove);
    setProtocolIdToRemove(0);
  };

  let columnsData: GridColDef[] = [];
  if (isAdmin(auth)) {
    columnsData.push({
      field: 'actions',
      headerName: 'Actions',
      width: 80,
      sortable: false,
      filterable: false,
      renderCell: (params: GridRenderCellParams<ProtocolItem>) => (
        <Tooltip title="Remove Protocol">
          <IconButton onClick={() => setProtocolIdToRemove(params.row.id)}>
            <ClearIcon sx={{ color: 'red' }} />
          </IconButton>
        </Tooltip>
      ),
    } as GridColDef);
  }

  columnsData = columnsData.concat([
    {
      field: 'name',
      headerName: 'Protocol',
      width: 250,
      renderCell: (params: GridRenderCellParams<ProtocolItem>) => (
        <Link
          sx={{
            textAlign: 'left',
            textOverflow: 'ellipsis',
            overflow: 'hidden',
            whiteSpace: 'nowrap',
          }}
          component="button"
          onClick={() =>
            navigate(`/admin/protocols/edit?protocolId=${params.row.id}`)
          }
        >
          {params.row.name}
        </Link>
      ),
    } as GridColDef,
    {
      field: 'url',
      headerName: 'URL',
      width: 250,
    } as GridColDef,
    {
      field: 'companyId',
      headerName: 'Company',
      width: 250,
      renderCell: (params: GridRenderCellParams<ProtocolItem>) => (
        <Typography>{companyListData.find(company => company.id === params.row.companyId)?.name}</Typography>
      ),
    } as GridColDef,
    {
      field: 'date',
      headerName: 'Date',
      width: 250,
      renderCell: (params: GridRenderCellParams<ProtocolItem>) => (
        <Typography>{params.row.date.toString().split('.')[0].replace('T', ' ')}</Typography>
      ),
    } as GridColDef,
    {
      field: 'createdBy',
      headerName: 'Created By',
      width: 250,
    } as GridColDef,
  ]);

  return (
    <div style={defaultUiSettings.listAreaStyle}>
      <Stack direction="row" spacing={2}>
        <Tooltip title="Add Protocol">
          <IconButton onClick={() => navigate('/admin/protocols/add')}>
            <AddToQueueIcon sx={{ color: 'green' }} />
          </IconButton>
        </Tooltip>
      </Stack>

      <div style={{ height: 'calc(110vh - 64px)' }}>
        <DataGrid
          getRowId={(row: ProtocolItem) => row.id}
          getRowHeight={() => 'auto'}
          sx={{
            backgroundColor: 'transparent',
            '& .MuiDataGrid-cell': {
              whiteSpace: 'normal',
              display: 'grid',
              alignContent: 'center',
              minHeight: 50,
            },
          }}
          rows={protocolListData}
          columns={columnsData}
          showToolbar={true}
          slots={{
            toolbar: CustomToolbar,
          }}
          isRowSelectable={() => false}
        />
      </div>

      <ConfirmDialog
        title="Remove Protocol"
        message="Are you sure you want to remove this Protocol?"
        okButtonText="Yes"
        cancelButtonText="No"
        onConfirm={removeProtocolConfirmed}
        onCancel={() => setProtocolIdToRemove(0)}
        show={protocolIdToRemove !== 0}
      />
    </div>
  );
};
