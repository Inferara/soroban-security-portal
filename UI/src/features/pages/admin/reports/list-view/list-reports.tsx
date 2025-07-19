import ClearIcon from '@mui/icons-material/Clear';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import DownloadIcon from '@mui/icons-material/Download';
import EditIcon from '@mui/icons-material/Edit';
import {
  CardMedia,
  IconButton,
  Tooltip,
  Modal,
  Box,
} from '@mui/material';
import {
  DataGrid,
  GridColDef,
  GridRenderCellParams,
} from '@mui/x-data-grid';
import { FC, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { Report } from '../../../../../api/soroban-security-portal/models/report';
import { CurrentPageState } from '../../admin-main-window/current-page-slice';
import { useListReports } from './hooks/index';
import { ConfirmDialog } from '../../admin-main-window/confirm-dialog';
import { CustomToolbar } from '../../../../components/custom-toolbar';
import { defaultUiSettings } from '../../../../../api/soroban-security-portal/models/ui-settings';
import { environment } from '../../../../../environments/environment';

export const ReportManagement: FC = () => {

  const currentPageState: CurrentPageState = {
    pageName: 'Reports',
    pageCode: 'reports',
    pageUrl: window.location.pathname,
    routePath: 'admin/reports',
  };

  const { reportListData, reportApprove, reportRemove, reportReject, downloadReport } = useListReports({ currentPageState });
  const [reportIdToRemove, setReportIdToRemove] = useState(0);
  const [clickedImage, setClickedImage] = useState<string | null>(null);
  const navigate = useNavigate();

  const removeReportConfirmed = async () => {
    await reportRemove(reportIdToRemove);
    setReportIdToRemove(0);
  };

  const handleImageClick = (imageUrl: string) => {
    setClickedImage(imageUrl);
  };

  const handleImageLeave = () => {
    setClickedImage(null);
  };

  const columnsData: GridColDef[] = [
    {
      field: 'actions',
      headerName: 'Actions',
      width: 300,
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
          <Tooltip title="Edit Report">
            <IconButton onClick={() => navigate(`/admin/reports/edit?reportId=${params.row.id}`)}>
              <EditIcon sx={{ color: 'green' }} />
            </IconButton>
          </Tooltip>
        </div>
      ),
    } as GridColDef,
    {
      field: 'author',
      headerName: 'Details',
      width: 750,
      renderCell: (params: GridRenderCellParams<Report>) => (
        <>
          <div>Author: <span style={{ color: 'gray' }}>{params.row.author}</span></div>
          <div>Project: <span style={{ color: 'gray' }}>{params.row.project}</span></div>
          <div>Auditor: <span style={{ color: 'gray' }}>{params.row.auditor}</span></div>
          <div>Date: <span style={{ color: 'gray' }}>{params.row.date.split('T')[0]}</span></div>
          <div>Published: <span style={{ color: 'gray' }}>{params.row.date.split('T')[0]}</span></div>
          <div>Title: <span style={{ color: 'gray' }}>{params.row.name}</span></div>
          <div>Last Action: <span style={{ color: 'gray' }}>{params.row.lastActionBy}</span></div>
          <div>Last Action At: <span style={{ color: 'gray' }}>{params.row.lastActionAt?.split('.')[0].replace('T', ' ')}</span></div>
        </>
      ),
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
      field: 'image',
      headerName: 'Image',
      width: 380,
      renderCell: (params: GridRenderCellParams<Report>) => {
        const imageUrl = `${environment.aiCoreApiUrl}/api/v1/reports/${params.row.id}/image.png`;
        return (
          <CardMedia
            component="img"
            sx={{ 
              objectFit: 'cover',
              objectPosition: 'top',
              height: '440px',
              transition: 'all 0.3s ease-in-out',
              cursor: 'pointer',
            }}
            height="540"
            image={imageUrl}
            alt={params.row.name}
            title="Click to see full image"
            onClick={() => handleImageClick(imageUrl)}
          />
        );
      },
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

      <Modal
        open={!!clickedImage}
        onClose={handleImageLeave}
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
        }}
      >
        <Box
          sx={{
            maxWidth: '40vw',
            maxHeight: '40vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {clickedImage && (
            <img
              src={clickedImage}
              alt="Full size report image"
              style={{
                maxWidth: '100%',
                maxHeight: '100%',
                objectFit: 'contain',
                borderRadius: '8px',
                boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
              }}
            />
          )}
        </Box>
      </Modal>
    </div>
  );
}; 