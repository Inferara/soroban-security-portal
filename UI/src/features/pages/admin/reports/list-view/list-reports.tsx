import AssignmentAddIcon from '@mui/icons-material/AssignmentAdd';
import ClearIcon from '@mui/icons-material/Clear';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import DownloadIcon from '@mui/icons-material/Download';
import EditIcon from '@mui/icons-material/Edit';
import { Box, CardMedia, IconButton, Modal, Tooltip } from '@mui/material';
import { GridColDef, GridRenderCellParams } from '@mui/x-data-grid';
import { FC, useMemo, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from 'react-oidc-context';

import { Report } from '../../../../../api/soroban-security-portal/models/report';
import { Role } from '../../../../../api/soroban-security-portal/models/role';
import { AdminDataGrid } from '../../../../../components/admin';
import { useListReports } from './hooks/index';
import { CurrentPageState } from '../../admin-main-window/current-page-slice';
import { environment } from '../../../../../environments/environment';
import { getStatusColor } from '../../../../../utils/status-utils';
import { ConfirmDialog } from '../../admin-main-window/confirm-dialog';

export const ReportManagement: FC = () => {
  const navigate = useNavigate();
  const auth = useAuth();
  const [clickedImage, setClickedImage] = useState<string | null>(null);
  const [removeId, setRemoveId] = useState(0);
  const [approveId, setApproveId] = useState(0);
  const [rejectId, setRejectId] = useState(0);

  const currentPageState: CurrentPageState = useMemo(() => ({
    pageName: 'Reports',
    pageCode: 'reports',
    pageUrl: window.location.pathname,
    routePath: 'admin/reports',
  }), []);

  const { reportListData, reportApprove, reportRemove, reportReject, downloadReport } = useListReports({ currentPageState });

  const isAdmin = auth.user?.profile.role === Role.Admin;

  const handleImageClick = useCallback((imageUrl: string) => {
    setClickedImage(imageUrl);
  }, []);

  const handleImageLeave = useCallback(() => {
    setClickedImage(null);
  }, []);

  const columnsData: GridColDef[] = useMemo(() => [
    {
      field: 'actions',
      headerName: 'Actions',
      width: 300,
      sortable: false,
      filterable: false,
      renderCell: (params: GridRenderCellParams<Report>) => (
        <div style={{ display: 'flex', gap: 4 }}>
          {isAdmin && (
            <Tooltip title="Remove Report">
              <IconButton onClick={() => setRemoveId(params.row.id)}>
                <ClearIcon sx={{ color: 'red' }} />
              </IconButton>
            </Tooltip>
          )}
          <Tooltip title="Approve Report">
            <IconButton onClick={() => setApproveId(params.row.id)}>
              <CheckCircleIcon sx={{ color: 'green' }} />
            </IconButton>
          </Tooltip>
          <Tooltip title="Reject Report">
            <IconButton onClick={() => setRejectId(params.row.id)}>
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
    },
    {
      field: 'author',
      headerName: 'Details',
      width: 750,
      renderCell: (params: GridRenderCellParams<Report>) => (
        <>
          <div>Created by: <span style={{ color: 'gray' }}>{params.row.createdBy}</span></div>
          <div>Company: <span style={{ color: 'gray' }}>{params.row.companyName}</span></div>
          <div>Protocol: <span style={{ color: 'gray' }}>{params.row.protocolName}</span></div>
          <div>Auditor: <span style={{ color: 'gray' }}>{params.row.auditorName}</span></div>
          <div>Date: <span style={{ color: 'gray' }}>{params.row.date.split('T')[0]}</span></div>
          <div>Published: <span style={{ color: 'gray' }}>{params.row.date.split('T')[0]}</span></div>
          <div>Title: <span style={{ color: 'gray' }}>{params.row.name}</span></div>
          <div>Last Action: <span style={{ color: 'gray' }}>{params.row.lastActionBy}</span></div>
          <div>Last Action At: <span style={{ color: 'gray' }}>{params.row.lastActionAt?.split('.')[0].replace('T', ' ')}</span></div>
        </>
      ),
    },
    {
      field: 'status',
      headerName: 'Status',
      width: 220,
      renderCell: (params: GridRenderCellParams<Report>) => (
        <span style={{ color: getStatusColor(params.row.status ?? ''), fontWeight: 'bold' }}>
          {params.row.status}
        </span>
      ),
    },
    {
      field: 'image',
      headerName: 'Image',
      width: 380,
      renderCell: (params: GridRenderCellParams<Report>) => {
        const imageUrl = `${environment.apiUrl}/api/v1/reports/${params.row.id}/image.png`;
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
    },
  ], [isAdmin, downloadReport, navigate, handleImageClick]);

  const handleApproveConfirmed = useCallback(async () => {
    await reportApprove(approveId);
    setApproveId(0);
  }, [reportApprove, approveId]);

  const handleRejectConfirmed = useCallback(async () => {
    await reportReject(rejectId);
    setRejectId(0);
  }, [reportReject, rejectId]);

  const imageModal = (
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
  );

  return (
    <>
      <AdminDataGrid<Report>
        rows={reportListData}
        columns={columnsData}
        getRowId={(row) => row.id}
        onRemove={reportRemove}
        addButton={{
          path: '/reports/add',
          icon: <AssignmentAddIcon sx={{ color: 'green' }} />,
          tooltip: 'Add Report',
        }}
        confirmDialog={{
          title: 'Remove Report',
          message: 'Are you sure you want to remove this Report?',
        }}
        itemIdToRemove={removeId}
        onItemIdToRemoveChange={setRemoveId}
        additionalContent={imageModal}
      />

      <ConfirmDialog
        title="Approve Report"
        message="Are you sure you want to approve this Report?"
        okButtonText="Yes"
        cancelButtonText="No"
        onConfirm={handleApproveConfirmed}
        onCancel={() => setApproveId(0)}
        show={approveId !== 0}
      />

      <ConfirmDialog
        title="Reject Report"
        message="Are you sure you want to reject this Report?"
        okButtonText="Yes"
        cancelButtonText="No"
        onConfirm={handleRejectConfirmed}
        onCancel={() => setRejectId(0)}
        show={rejectId !== 0}
      />
    </>
  );
};
