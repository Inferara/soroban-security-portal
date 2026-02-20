import AssignmentAddIcon from '@mui/icons-material/AssignmentAdd';
import ClearIcon from '@mui/icons-material/Clear';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import DownloadIcon from '@mui/icons-material/Download';
import EditIcon from '@mui/icons-material/Edit';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import {
  Alert,
  AlertTitle,
  Box,
  Button,
  CardMedia,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Modal,
  Tooltip,
  Typography,
} from '@mui/material';
import { GridRenderCellParams } from '@mui/x-data-grid';
import { FC, useMemo, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from 'react-oidc-context';

import { Report } from '../../../../../api/soroban-security-portal/models/report';
import { Role } from '../../../../../api/soroban-security-portal/models/role';
import { AdminDataGrid, ResponsiveColumn } from '../../../../../components/admin';
import { useListReports } from './hooks/index';
import { CurrentPageState } from '../../admin-main-window/current-page-slice';
import { environment } from '../../../../../environments/environment';
import { getStatusColor } from '../../../../../utils/status-utils';
import { ConfirmDialog } from '../../admin-main-window/confirm-dialog';
import { TouchTargets } from '../../../../../theme';

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

  const {
    reportListData,
    reportApprove,
    reportRemove,
    reportReject,
    downloadReport,
    extractVulnerabilities,
    extractingReportId,
    extractionResult,
    extractionError,
    clearExtractionResult,
  } = useListReports({ currentPageState });

  const isAdmin = auth.user?.profile.role === Role.Admin;
  const isModerator = auth.user?.profile.role === Role.Moderator;
  const canExtract = isAdmin || isModerator;

  // Extraction dialog state
  const [extractConfirmId, setExtractConfirmId] = useState(0);

  const handleImageClick = useCallback((imageUrl: string) => {
    setClickedImage(imageUrl);
  }, []);

  const handleImageLeave = useCallback(() => {
    setClickedImage(null);
  }, []);

  const columnsData: ResponsiveColumn[] = useMemo(() => [
    {
      field: 'actions',
      headerName: 'Actions',
      width: 160,
      mobileWidth: 160,
      priority: 'essential',
      sortable: false,
      filterable: false,
      renderCell: (params: GridRenderCellParams<Report>) => (
        <Box sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, auto)',
          gap: 0.5,
          justifyContent: 'start'
        }}>
          {/* Row 1: Approve, Reject, Download */}
          <Tooltip title="Approve Report">
            <IconButton
              onClick={() => setApproveId(params.row.id)}
              sx={{ minWidth: TouchTargets.primary, minHeight: TouchTargets.primary }}
            >
              <CheckCircleIcon sx={{ color: 'green' }} />
            </IconButton>
          </Tooltip>
          <Tooltip title="Reject Report">
            <IconButton
              onClick={() => setRejectId(params.row.id)}
              sx={{ minWidth: TouchTargets.primary, minHeight: TouchTargets.primary }}
            >
              <CancelIcon sx={{ color: 'red' }} />
            </IconButton>
          </Tooltip>
          <Tooltip title="Download Report">
            <IconButton
              onClick={() => downloadReport(params.row.id)}
              sx={{ minWidth: TouchTargets.primary, minHeight: TouchTargets.primary }}
            >
              <DownloadIcon sx={{ color: 'blue' }} />
            </IconButton>
          </Tooltip>
          {/* Row 2: Edit, Extract, Remove (admin only) */}
          <Tooltip title="Edit Report">
            <IconButton
              onClick={() => navigate(`/admin/reports/edit?reportId=${params.row.id}`)}
              sx={{ minWidth: TouchTargets.primary, minHeight: TouchTargets.primary }}
            >
              <EditIcon sx={{ color: 'green' }} />
            </IconButton>
          </Tooltip>
          {isAdmin && (
            <Tooltip title="Remove Report">
              <IconButton
                onClick={() => setRemoveId(params.row.id)}
                sx={{ minWidth: TouchTargets.primary, minHeight: TouchTargets.primary }}
              >
                <ClearIcon sx={{ color: 'red' }} />
              </IconButton>
            </Tooltip>
          )}
          {canExtract && (
            <Tooltip title="Extract Vulnerabilities from Report (AI)">
              <IconButton
                onClick={() => setExtractConfirmId(params.row.id)}
                disabled={extractingReportId === params.row.id}
                aria-label="Extract vulnerabilities from report using AI"
                sx={{ minWidth: TouchTargets.primary, minHeight: TouchTargets.primary }}
              >
                {extractingReportId === params.row.id ? (
                  <CircularProgress size={20} />
                ) : (
                  <AutoAwesomeIcon sx={{ color: '#9333EA' }} />
                )}
              </IconButton>
            </Tooltip>
          )}
        </Box>
      ),
    },
    {
      field: 'author',
      headerName: 'Details',
      width: 750,
      mobileWidth: 200,
      priority: 'essential',
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
      mobileWidth: 100,
      priority: 'important',
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
      priority: 'optional',
      hideOnMobile: true,
      hideOnTablet: true,
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
  ], [isAdmin, canExtract, downloadReport, navigate, handleImageClick, extractingReportId]);

  const handleApproveConfirmed = useCallback(async () => {
    await reportApprove(approveId);
    setApproveId(0);
  }, [reportApprove, approveId]);

  const handleRejectConfirmed = useCallback(async () => {
    await reportReject(rejectId);
    setRejectId(0);
  }, [reportReject, rejectId]);

  const handleExtractConfirmed = useCallback(async () => {
    const reportIdToExtract = extractConfirmId;
    // Keep dialog open during extraction - it will show loading state
    await extractVulnerabilities(reportIdToExtract);
    // Only close after extraction completes
    setExtractConfirmId(0);
  }, [extractVulnerabilities, extractConfirmId]);

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

      {/* Extract Vulnerabilities Confirmation Dialog */}
      <Dialog
        open={extractConfirmId !== 0}
        onClose={() => !extractingReportId && setExtractConfirmId(0)}
        aria-labelledby="extract-confirm-title"
        aria-describedby="extract-confirm-description"
      >
        <DialogTitle id="extract-confirm-title">Extract Vulnerabilities</DialogTitle>
        <DialogContent>
          <Typography id="extract-confirm-description" gutterBottom>
            This will analyze the report content using AI to extract vulnerabilities.
          </Typography>
          <Alert severity="info" sx={{ mt: 2 }}>
            <AlertTitle>Important</AlertTitle>
            <ul style={{ margin: 0, paddingLeft: 20 }}>
              <li>AI extraction may not be 100% accurate</li>
              <li>Extracted vulnerabilities require manual review</li>
            </ul>
          </Alert>
          <Typography sx={{ mt: 2 }}>
            Continue with extraction?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setExtractConfirmId(0)}
            disabled={extractingReportId === extractConfirmId}
          >
            Cancel
          </Button>
          <Button
            onClick={handleExtractConfirmed}
            variant="contained"
            color="primary"
            disabled={extractingReportId === extractConfirmId}
            startIcon={extractingReportId === extractConfirmId ? <CircularProgress size={16} /> : undefined}
          >
            {extractingReportId === extractConfirmId ? 'Extracting...' : 'Extract'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Extraction Result Dialog */}
      <Dialog
        open={extractionResult !== null}
        onClose={clearExtractionResult}
        role="alertdialog"
        aria-labelledby="extraction-result-title"
      >
        <DialogTitle id="extraction-result-title" sx={{ color: 'success.main' }}>
          Extraction Complete
        </DialogTitle>
        <DialogContent>
          <Box aria-live="polite">
            <Typography>Vulnerabilities found: {extractionResult?.totalExtracted ?? 0}</Typography>
            <Typography>New vulnerabilities created: {extractionResult?.totalCreated ?? 0}</Typography>
            <Typography>Duplicates skipped: {extractionResult?.duplicatesSkipped ?? 0}</Typography>
            <Typography variant="caption" color="text.secondary">
              Processing time: {((extractionResult?.processingTimeMs ?? 0) / 1000).toFixed(1)}s
            </Typography>
          </Box>
          {extractionResult?.validationWarnings && extractionResult.validationWarnings.length > 0 && (
            <Alert severity="warning" sx={{ mt: 2 }}>
              <AlertTitle>Validation Warnings</AlertTitle>
              <ul style={{ margin: 0, paddingLeft: 20 }}>
                {extractionResult.validationWarnings.map((warning, index) => (
                  <li key={index}>{warning}</li>
                ))}
              </ul>
            </Alert>
          )}
          {extractionResult?.processingErrors && extractionResult.processingErrors.length > 0 && (
            <Alert severity="error" sx={{ mt: 2 }}>
              <AlertTitle>Processing Errors</AlertTitle>
              <ul style={{ margin: 0, paddingLeft: 20 }}>
                {extractionResult.processingErrors.map((error, index) => (
                  <li key={index}>{error}</li>
                ))}
              </ul>
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={clearExtractionResult}>Close</Button>
          <Button
            variant="contained"
            onClick={() => {
              clearExtractionResult();
              navigate('/admin/vulnerabilities');
            }}
          >
            View Vulnerabilities
          </Button>
        </DialogActions>
      </Dialog>

      {/* Extraction Error Dialog */}
      <Dialog
        open={extractionError !== null}
        onClose={clearExtractionResult}
        role="alertdialog"
        aria-labelledby="extraction-error-title"
      >
        <DialogTitle id="extraction-error-title" sx={{ color: 'error.main' }}>
          Extraction Failed
        </DialogTitle>
        <DialogContent>
          <Alert severity="error">
            {extractionError}
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={clearExtractionResult}>Close</Button>
        </DialogActions>
      </Dialog>
    </>
  );
};
