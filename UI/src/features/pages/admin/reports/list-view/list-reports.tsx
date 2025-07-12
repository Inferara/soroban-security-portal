import ClearIcon from '@mui/icons-material/Clear';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import DownloadIcon from '@mui/icons-material/Download';
import {
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  DataGrid,
  GridColDef,
  GridRenderCellParams,
} from '@mui/x-data-grid';
import { FC, useState } from 'react';

import { Report } from '../../../../../api/soroban-security-portal/models/report';
import { CurrentPageState } from '../../admin-main-window/current-page-slice';
import { useListReports } from './hooks/index';
import { ConfirmDialog } from '../../admin-main-window/confirm-dialog';
import { CustomToolbar } from '../../../../components/custom-toolbar';
import { defaultUiSettings } from '../../../../../api/soroban-security-portal/models/ui-settings';

export const ReportManagement: FC = () => {

  const currentPageState: CurrentPageState = {
    pageName: 'Reports',
    pageCode: 'reports',
    pageUrl: window.location.pathname,
    routePath: 'admin/reports',
  };

  const { reportListData, reportApprove, reportRemove, reportReject, downloadReport } = useListReports({ currentPageState });
  const [reportIdToRemove, setReportIdToRemove] = useState(0);

  const removeReportConfirmed = async () => {
    await reportRemove(reportIdToRemove);
    setReportIdToRemove(0);
  };

  const columnsData: GridColDef[] = [
    {
      field: 'actions',
      headerName: 'Actions',
      width: 200,
      sortable: false,
      filterable: false,
      renderCell: (params: GridRenderCellParams<Report>) => (
        <div style={{ display: 'flex', gap: 4 }}>
          <Tooltip title="Remove Report">
            <IconButton onClick={() => setReportIdToRemove(params.row.id)}>
              <ClearIcon sx={{ color: 'red' }} />
            </IconButton>
          </Tooltip>
          <Tooltip title="Approve Report">
            <IconButton onClick={() => reportApprove(params.row.id)}>
              <CheckCircleIcon sx={{ color: 'green' }} />
            </IconButton>
          </Tooltip>
          <Tooltip title="Reject Report">
            <IconButton onClick={() => reportReject(params.row.id)}>
              <CancelIcon sx={{ color: 'red' }} />
            </IconButton>
          </Tooltip>
          <Tooltip title="Download Report">
            <IconButton onClick={() => downloadReport(params.row.id)}>
              <DownloadIcon sx={{ color: 'blue' }} />
            </IconButton>
          </Tooltip>
        </div>
      ),
    } as GridColDef,
    {
      field: 'name',
      headerName: 'Title',
      width: 550,
    } as GridColDef,
    {
      field: 'status',
      headerName: 'Status',
      width: 220,
      renderCell: (params: GridRenderCellParams<Report>) => {
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
            color: getStatusColor(params.row.status ?? ""),
            fontWeight: 'bold'
          }}>
            {params.row.status}
          </span>
        );
      },
    } as GridColDef,
    {
      field: 'author',
      headerName: 'Details',
      width: 350,
      renderCell: (params: GridRenderCellParams<Report>) => (
        <>
          <div>Author: <span style={{ fontWeight: 'bold' }}>{params.row.author}</span></div>
          <div>Project: <span style={{ fontWeight: 'bold' }}>{params.row.project}</span></div>
          <div>Auditor: <span style={{ fontWeight: 'bold' }}>{params.row.auditor}</span></div>
          <div>Date: <span style={{ fontWeight: 'bold' }}>{params.row.date.split('T')[0]}</span></div>
        </>
      ),
    } as GridColDef,
    {
      field: 'date',
      headerName: 'Published',
      width: 220,
      renderCell: (params: GridRenderCellParams<Report>) => (
        <span>{params.row.date.split('T')[0]}</span>
      ),
    } as GridColDef,
    {
      field: 'image',
      headerName: 'Image',
      width: 180,
      renderCell: (params: GridRenderCellParams<Report>) => (
        <Tooltip
          title={
            <img 
              src={`data:image/jpeg;base64,${params.row.image}`} 
              alt="Report" 
              style={{ 
                maxWidth: '800px', 
                maxHeight: '800px', 
                objectFit: 'contain',
                border: '1px solid #ccc',
                borderRadius: '4px'
              }} 
            />
          }
          arrow
          placement="right"
        >
          <img 
            src={`data:image/jpeg;base64,${params.row.image}`} 
            alt="Report" 
            style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
          />
        </Tooltip>
      ),
    } as GridColDef,
    {
      field: 'lastActionBy',
      headerName: 'Last Action',
      width: 250,
      renderCell: (params: GridRenderCellParams<Report>) => (
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
          getRowId={(row: Report) => row.id}
          getRowHeight={() => 'auto'}
          sx={{
            '& .MuiDataGrid-cell': {
              whiteSpace: 'normal',
              display: 'grid',
              alignContent: 'center',
              minHeight: 50,
            },
          }}
          rows={reportListData}
          columns={columnsData}
          showToolbar={true}
          slots={{
            toolbar: CustomToolbar,
          }}
          isRowSelectable={() => false}
        />
      </div>

      <ConfirmDialog
        title="Remove Report"
        message="Are you sure you want to remove this Report?"
        okButtonText="Yes"
        cancelButtonText="No"
        onConfirm={removeReportConfirmed}
        onCancel={() => setReportIdToRemove(0)}
        show={reportIdToRemove !== 0}
      />
    </div>
  );
}; 