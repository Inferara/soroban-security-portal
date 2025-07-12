import PersonAddIcon from '@mui/icons-material/PersonAdd';
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

import { AuditorItem } from '../../../../../api/soroban-security-portal/models/auditor.ts';
import { CurrentPageState } from '../../admin-main-window/current-page-slice.ts';
import { useListAuditors } from './hooks/index.ts';
import { ConfirmDialog } from '../../admin-main-window/confirm-dialog.tsx';
import { CustomToolbar } from '../../../../components/custom-toolbar.tsx';
import { useNavigate } from 'react-router-dom';
import { defaultUiSettings } from '../../../../../api/soroban-security-portal/models/ui-settings.ts';

export const ListAuditors: FC = () => {
  const navigate = useNavigate();

  const currentPageState: CurrentPageState = {
    pageName: 'Auditors',
    pageCode: 'auditors',
    pageUrl: window.location.pathname,
    routePath: 'admin/auditors',
  };

  const { auditorListData, auditorRemove } = useListAuditors({ currentPageState });
  const [auditorIdToRemove, setAuditorIdToRemove] = useState(0);

  const removeAuditorConfirmed = async () => {
    await auditorRemove(auditorIdToRemove);
    setAuditorIdToRemove(0);
  };

  const columnsData: GridColDef[] = [
    {
      field: 'actions',
      headerName: 'Actions',
      width: 80,
      sortable: false,
      filterable: false,
      renderCell: (params: GridRenderCellParams<AuditorItem>) => (
        <Tooltip title="Remove Auditor">
          <IconButton onClick={() => setAuditorIdToRemove(params.row.id)}>
            <ClearIcon sx={{ color: 'red' }} />
          </IconButton>
        </Tooltip>
      ),
    } as GridColDef,
    {
      field: 'name',
      headerName: 'Auditor',
      width: 250,
      renderCell: (params: GridRenderCellParams<AuditorItem>) => (
        <Link
          sx={{
            textAlign: 'left',
            textOverflow: 'ellipsis',
            overflow: 'hidden',
            whiteSpace: 'nowrap',
          }}
          component="button"
          onClick={() =>
            navigate(`/admin/auditors/edit?auditorId=${params.row.id}`)
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
      field: 'date',
      headerName: 'Date',
      width: 250,
      renderCell: (params: GridRenderCellParams<AuditorItem>) => (
        <Typography>{params.row.date.toString().split('.')[0].replace('T', ' ')}</Typography>
      ),
    } as GridColDef,
    {
      field: 'createdBy',
      headerName: 'Created By',
      width: 250,
    } as GridColDef,
  ];

  return (
    <div style={defaultUiSettings.listAreaStyle}>
      <Stack direction="row" spacing={2}>
        <Tooltip title="Add Auditor">
          <IconButton onClick={() => navigate('/admin/auditors/add')}>
            <PersonAddIcon sx={{ color: 'green' }} />
          </IconButton>
        </Tooltip>
      </Stack>

      <div style={{ height: 'calc(110vh - 64px)' }}>
        <DataGrid
          getRowId={(row: AuditorItem) => row.id}
          getRowHeight={() => 'auto'}
          sx={{
            '& .MuiDataGrid-cell': {
              whiteSpace: 'normal',
              display: 'grid',
              alignContent: 'center',
              minHeight: 50,
            },
          }}
          rows={auditorListData}
          columns={columnsData}
          showToolbar={true}
          slots={{
            toolbar: CustomToolbar,
          }}
          isRowSelectable={() => false}
        />
      </div>

      <ConfirmDialog
        title="Remove Auditor"
        message="Are you sure you want to remove this Auditor?"
        okButtonText="Yes"
        cancelButtonText="No"
        onConfirm={removeAuditorConfirmed}
        onCancel={() => setAuditorIdToRemove(0)}
        show={auditorIdToRemove !== 0}
      />
    </div>
  );
};
