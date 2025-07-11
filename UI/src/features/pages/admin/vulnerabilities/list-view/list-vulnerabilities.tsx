import ClearIcon from '@mui/icons-material/Clear';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import {
  IconButton,
  Link,
  Tooltip,
} from '@mui/material';
import {
  DataGrid,
  GridColDef,
  GridRenderCellParams,
} from '@mui/x-data-grid';
import { FC, useState } from 'react';

import { Vulnerability } from '../../../../../api/soroban-security-portal/models/vulnerability.ts';
import { CurrentPageState } from '../../admin-main-window/current-page-slice.ts';
import { useListVulnerabilities } from './hooks/index.ts';
import { ConfirmDialog } from '../../admin-main-window/confirm-dialog.tsx';
import { CustomToolbar } from '../../../../components/custom-toolbar.tsx';
import { defaultUiSettings } from '../../../../../api/soroban-security-portal/models/ui-settings.ts';

export const VulnerabilityManagement: FC = () => {

  const currentPageState: CurrentPageState = {
    pageName: 'Vulnerabilities',
    pageCode: 'vulnerabilities',
    pageUrl: window.location.pathname,
    routePath: 'admin/vulnerabilities',
  };

  const { vulnerabilityListData, vulnerabilityApprove, vulnerabilityRemove, vulnerabilityReject } = useListVulnerabilities({ currentPageState });
  const [vulnerabilityIdToRemove, setVulnerabilityIdToRemove] = useState(0);

  const removeVulnerabilityConfirmed = async () => {
    await vulnerabilityRemove(vulnerabilityIdToRemove);
    setVulnerabilityIdToRemove(0);
  };

  const columnsData: GridColDef[] = [
    {
      field: 'actions',
      headerName: 'Actions',
      width: 180,
      sortable: false,
      filterable: false,
      renderCell: (params: GridRenderCellParams<Vulnerability>) => (
        <div style={{ display: 'flex', gap: 4 }}>
          <Tooltip title="Remove Vulnerability">
            <IconButton onClick={() => setVulnerabilityIdToRemove(params.row.id)}>
              <ClearIcon sx={{ color: 'red' }} />
            </IconButton>
          </Tooltip>
          <Tooltip title="Approve Vulnerability">
            <IconButton onClick={() => vulnerabilityApprove(params.row.id)}>
              <CheckCircleIcon sx={{ color: 'green' }} />
            </IconButton>
          </Tooltip>
          <Tooltip title="Reject Vulnerability">
            <IconButton onClick={() => vulnerabilityReject(params.row.id)}>
              <CancelIcon sx={{ color: 'red' }} />
            </IconButton>
          </Tooltip>
        </div>
      ),
    } as GridColDef,
    {
      field: 'title',
      headerName: 'Title',
      width: 250,
    } as GridColDef,
    {
      field: 'status',
      headerName: 'Status',
      width: 220,
      renderCell: (params: GridRenderCellParams<Vulnerability>) => {
        const getStatusColor = (status: string) => {
          switch (status.toLowerCase()) {
            case 'new':
              return '#DAA520'; // dark yellow
            case 'approved':
              return '#4CAF50'; // green
            case 'rejected':
              return '#F44336'; // red
            default:
              return 'inherit';
          }
        };
        return (
          <span style={{ 
            color: getStatusColor(params.row.status),
            fontWeight: 'bold'
          }}>
            {params.row.status}
          </span>
        );
      },
    } as GridColDef,
    {
      field: 'description',
      headerName: 'Description',
      width: 350,
      renderCell: (params: GridRenderCellParams<Vulnerability>) => {
        const description = params.row.description || '';
        const truncatedDescription = description.length > 500 
          ? description.substring(0, 500) + '...' 
          : description;
        
        return (
          <div style={{ 
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word'
          }}>
            {truncatedDescription}
          </div>
        );
      },
    } as GridColDef,
    {
      field: 'details',
      headerName: 'Details',
      width: 320,
      renderCell: (params: GridRenderCellParams<Vulnerability>) => (
        <div>
          <div>Categories: {params.row.categories.join(', ')}</div>
          <div>Source: {params.row.source}</div>
          <div>Project: {params.row.project}</div>
          <div>Severity: {params.row.severity}</div>
        </div>
      ),
    } as GridColDef,
    {
      field: 'reportUrl',
      headerName: 'Report Url',
      width: 300,
      renderCell: (params: GridRenderCellParams<Vulnerability>) => (
        <Link
          sx={{
            textAlign: 'left',
            textOverflow: 'ellipsis',
            overflow: 'hidden',
            whiteSpace: 'nowrap',
          }}
          href={`${params.row.reportUrl}`}
          target="_top"
          rel="noopener"
        >
          {params.row.reportUrl}
        </Link>
      ),
    } as GridColDef,
    {
      field: 'lastActionBy',
      headerName: 'Last Action',
      width: 250,
      renderCell: (params: GridRenderCellParams<Vulnerability>) => (
        <div>
          <div>{params.row.lastActionBy}</div>
          <div>{params.row.lastActionAt?.split('.')[0].replace('T', ' ')}</div>
        </div>
      ),
    } as GridColDef,
  ];

  return (
    <div style={defaultUiSettings.listAreaStyle}>
      <div style={{ height: 'calc(110vh - 64px)' }}>
        <DataGrid
          getRowId={(row: Vulnerability) => row.id}
          getRowHeight={() => 'auto'}
          sx={{
            '& .MuiDataGrid-cell': {
              whiteSpace: 'normal',
              display: 'grid',
              alignContent: 'center',
              minHeight: 50,
            },
          }}
          rows={vulnerabilityListData}
          columns={columnsData}
          showToolbar={true}
          slots={{
            toolbar: CustomToolbar,
          }}
          isRowSelectable={() => false}
        />
      </div>

      <ConfirmDialog
        title="Remove Vulnerability"
        message="Are you sure you want to remove this Vulnerability?"
        okButtonText="Yes"
        cancelButtonText="No"
        onConfirm={removeVulnerabilityConfirmed}
        onCancel={() => setVulnerabilityIdToRemove(0)}
        show={vulnerabilityIdToRemove !== 0}
      />
    </div>
  );
};
