import React from 'react';
import { CurrentPageState } from '../admin-main-window/current-page-slice'
import { 
  Typography,
} from '@mui/material'
import {
  DataGrid,
  GridColDef,
  GridRenderCellParams,
} from '@mui/x-data-grid';
import { useSubscriptions } from './hooks';
import { Subscription } from '../../../../api/soroban-security-portal/models/subscription';
import { CustomToolbar } from '../../../components/custom-toolbar';
import { defaultUiSettings } from '../../../../api/soroban-security-portal/models/ui-settings';

export const Subscriptions: React.FC = () => {
  const currentPageState: CurrentPageState = {
    pageName: 'Subscriptions',
    pageCode: 'subscriptions',
    pageUrl: window.location.pathname,
    routePath: 'subscriptions',
  }

  const {
    subscriptionsListData,
  } = useSubscriptions({ currentPageState });

  const columnsData: GridColDef[] = [
    {
      field: 'email',
      headerName: 'Email',
      width: 400,
      renderCell: (params: GridRenderCellParams<Subscription>) => (
        <Typography variant="body2">
          {params.row.email}
        </Typography>
      ),
    } as GridColDef,
    {
      field: 'date',
      headerName: 'Subscription Date',
      width: 200,
      renderCell: (params: GridRenderCellParams<Subscription>) => (
        <Typography variant="body2">
          {params.row.date ? new Date(params.row.date).toLocaleDateString() : 'Never'}
        </Typography>
      ),
    } as GridColDef,
  ];

  return (
    <div style={defaultUiSettings.listAreaStyle}>
      <div style={{ height: 'calc(110vh - 64px)' }}>
        <DataGrid
          getRowId={(row: Subscription) => row.id}
          getRowHeight={() => 'auto'}
          sx={{
            '& .MuiDataGrid-cell': {
              whiteSpace: 'normal',
              display: 'grid',
              alignContent: 'center',
              minHeight: 50,
            },
          }}
          rows={subscriptionsListData}
          columns={columnsData}
          showToolbar={true}
          slots={{
            toolbar: CustomToolbar,
          }}
          isRowSelectable={() => false}
        />
      </div>
    </div>
  );
} 