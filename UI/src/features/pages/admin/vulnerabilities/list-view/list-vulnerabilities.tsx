import PostAdd from '@mui/icons-material/PostAdd';
import ClearIcon from '@mui/icons-material/Clear';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import EditIcon from '@mui/icons-material/Edit';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import { Box, IconButton, Link, Tooltip, Typography } from '@mui/material';
import { GridRenderCellParams } from '@mui/x-data-grid';
import { FC, useEffect, useMemo, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from 'react-oidc-context';

import { Vulnerability } from '../../../../../api/soroban-security-portal/models/vulnerability';
import { Role } from '../../../../../api/soroban-security-portal/models/role';
import { AdminDataGrid, ResponsiveColumn } from '../../../../../components/admin';
import { useListVulnerabilities } from './hooks/index';
import { CurrentPageState } from '../../admin-main-window/current-page-slice';
import { MarkdownView } from '../../../../../components/MarkdownView';
import { getStatusColor } from '../../../../../utils/status-utils';
import { ConfirmDialog } from '../../admin-main-window/confirm-dialog';
import { TouchTargets } from '../../../../../theme';

export const VulnerabilityManagement: FC = () => {
  const navigate = useNavigate();
  const auth = useAuth();
  const [collapsedDescriptions, setCollapsedDescriptions] = useState<Set<string>>(new Set());
  const [removeId, setRemoveId] = useState(0);
  const [approveId, setApproveId] = useState(0);
  const [rejectId, setRejectId] = useState(0);

  const currentPageState: CurrentPageState = useMemo(() => ({
    pageName: 'Vulnerabilities',
    pageCode: 'vulnerabilities',
    pageUrl: window.location.pathname,
    routePath: 'admin/vulnerabilities',
  }), []);

  const { vulnerabilityListData, vulnerabilityApprove, vulnerabilityRemove, vulnerabilityReject } = useListVulnerabilities({ currentPageState });

  const isAdmin = auth.user?.profile.role === Role.Admin;

  useEffect(() => {
    setCollapsedDescriptions(new Set(vulnerabilityListData.map(vuln => vuln.id.toString())));
  }, [vulnerabilityListData]);

  const shouldShowCollapse = useCallback((description: string) => {
    return description.split('\n').length > 6;
  }, []);

  const getTruncatedDescription = useCallback((description: string) => {
    const lines = description.split('\n');
    if (lines.length <= 6) {
      return description;
    }
    return lines.slice(0, 6).join('\n');
  }, []);

  const toggleDescriptionCollapse = useCallback((id: string) => {
    setCollapsedDescriptions(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  }, []);

  const columnsData: ResponsiveColumn[] = useMemo(() => [
    {
      field: 'actions',
      headerName: 'Actions',
      width: 220,
      mobileWidth: 160,
      priority: 'essential',
      sortable: false,
      filterable: false,
      renderCell: (params: GridRenderCellParams<Vulnerability>) => (
        <div style={{ display: 'flex', gap: 4 }}>
          {isAdmin && (
            <Tooltip title="Remove Vulnerability">
              <IconButton
                onClick={() => setRemoveId(params.row.id)}
                sx={{ minWidth: TouchTargets.primary, minHeight: TouchTargets.primary }}
              >
                <ClearIcon sx={{ color: 'red' }} />
              </IconButton>
            </Tooltip>
          )}
          <Tooltip title="Approve Vulnerability">
            <IconButton
              onClick={() => setApproveId(params.row.id)}
              sx={{ minWidth: TouchTargets.primary, minHeight: TouchTargets.primary }}
            >
              <CheckCircleIcon sx={{ color: 'green' }} />
            </IconButton>
          </Tooltip>
          <Tooltip title="Reject Vulnerability">
            <IconButton
              onClick={() => setRejectId(params.row.id)}
              sx={{ minWidth: TouchTargets.primary, minHeight: TouchTargets.primary }}
            >
              <CancelIcon sx={{ color: 'red' }} />
            </IconButton>
          </Tooltip>
          <Tooltip title="Edit Vulnerability">
            <IconButton
              onClick={() => navigate(`/admin/vulnerabilities/edit?vulnerabilityId=${params.row.id}`)}
              sx={{ minWidth: TouchTargets.primary, minHeight: TouchTargets.primary }}
            >
              <EditIcon sx={{ color: 'green' }} />
            </IconButton>
          </Tooltip>
        </div>
      ),
    },
    {
      field: 'title',
      headerName: 'Title',
      width: 250,
      mobileWidth: 150,
      priority: 'essential',
    },
    {
      field: 'status',
      headerName: 'Status',
      width: 180,
      mobileWidth: 100,
      priority: 'important',
      renderCell: (params: GridRenderCellParams<Vulnerability>) => (
        <span style={{ color: getStatusColor(params.row.status), fontWeight: 'bold' }}>
          {params.row.status}
        </span>
      ),
    },
    {
      field: 'description',
      headerName: 'Description',
      width: 950,
      priority: 'optional',
      hideOnMobile: true,
      hideOnTablet: true,
      renderCell: (params: GridRenderCellParams<Vulnerability>) => {
        const isCollapsed = collapsedDescriptions.has(params.row.id.toString());
        return (
          <>
            <MarkdownView
              content={isCollapsed ? getTruncatedDescription(params.row.description) : params.row.description}
              background={{ p: 2 }}
              sx={{
                maxHeight: isCollapsed ? '150px' : '400px',
                overflowY: 'auto',
              }}
            />
            {shouldShowCollapse(params.row.description) && (
              <Box sx={{ mt: 1, display: 'flex', alignItems: 'center' }}>
                <IconButton
                  onClick={() => toggleDescriptionCollapse(params.row.id.toString())}
                  sx={{ minWidth: TouchTargets.minimum, minHeight: TouchTargets.minimum }}
                >
                  {isCollapsed ? <ExpandMoreIcon /> : <ExpandLessIcon />}
                </IconButton>
                <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                  {isCollapsed ? 'Show more' : 'Show less'}
                </Typography>
              </Box>
            )}
          </>
        );
      },
    },
    {
      field: 'details',
      headerName: 'Details',
      width: 420,
      priority: 'important',
      hideOnMobile: true,
      renderCell: (params: GridRenderCellParams<Vulnerability>) => (
        <div>
          <div>Tags: <span style={{ color: 'gray' }}>{params.row.tags.join(', ')}</span></div>
          <div>Source: <span style={{ color: 'gray' }}>{params.row.reportName}</span></div>
          <div>Company: <span style={{ color: 'gray' }}>{params.row.companyName}</span></div>
          <div>Protocol: <span style={{ color: 'gray' }}>{params.row.protocolName}</span></div>
          <div>Severity: <span style={{ color: 'gray' }}>{params.row.severity}</span></div>
          <div>Last Action: <span style={{ color: 'gray' }}>{params.row.lastActionBy}</span></div>
          <div>Last Action At: <span style={{ color: 'gray' }}>{params.row.lastActionAt?.split('.')[0].replace('T', ' ')}</span></div>
          <div>Report URL: <Link style={{ color: 'gray' }} href={params.row.reportUrl} target="_blank" rel="noopener">{params.row.reportUrl}</Link></div>
        </div>
      ),
    },
  ], [isAdmin, navigate, collapsedDescriptions, getTruncatedDescription, shouldShowCollapse, toggleDescriptionCollapse]);

  const handleApproveConfirmed = useCallback(async () => {
    await vulnerabilityApprove(approveId);
    setApproveId(0);
  }, [vulnerabilityApprove, approveId]);

  const handleRejectConfirmed = useCallback(async () => {
    await vulnerabilityReject(rejectId);
    setRejectId(0);
  }, [vulnerabilityReject, rejectId]);

  return (
    <>
      <AdminDataGrid<Vulnerability>
        rows={vulnerabilityListData}
        columns={columnsData}
        getRowId={(row) => row.id}
        onRemove={vulnerabilityRemove}
        addButton={{
          path: '/vulnerabilities/add',
          icon: <PostAdd sx={{ color: 'green' }} />,
          tooltip: 'Add Vulnerability',
        }}
        confirmDialog={{
          title: 'Remove Vulnerability',
          message: 'Are you sure you want to remove this Vulnerability?',
        }}
        itemIdToRemove={removeId}
        onItemIdToRemoveChange={setRemoveId}
      />

      <ConfirmDialog
        title="Approve Vulnerability"
        message="Are you sure you want to approve this Vulnerability?"
        okButtonText="Yes"
        cancelButtonText="No"
        onConfirm={handleApproveConfirmed}
        onCancel={() => setApproveId(0)}
        show={approveId !== 0}
      />

      <ConfirmDialog
        title="Reject Vulnerability"
        message="Are you sure you want to reject this Vulnerability?"
        okButtonText="Yes"
        cancelButtonText="No"
        onConfirm={handleRejectConfirmed}
        onCancel={() => setRejectId(0)}
        show={rejectId !== 0}
      />
    </>
  );
};
