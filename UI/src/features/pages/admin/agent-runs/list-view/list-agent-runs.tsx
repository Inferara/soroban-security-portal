import { FC, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Button, Chip, IconButton, Tooltip } from '@mui/material';
import { DataGrid, GridColDef, GridRenderCellParams } from '@mui/x-data-grid';
import VisibilityIcon from '@mui/icons-material/Visibility';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import ReplayIcon from '@mui/icons-material/Replay';
import { useListAgentRuns } from './hooks';
import { CurrentPageState } from '../../admin-main-window/current-page-slice';
import { AgentRunListItem, AgentRunStatus } from '../../../../../api/soroban-security-portal/models/agent-run';

const currentPageState: CurrentPageState = {
  pageName: 'Agent Runs',
  pageCode: 'agentRuns',
  pageUrl: window.location.pathname,
  routePath: 'admin/agent-runs',
};

const statusColor = (status: string): 'default' | 'info' | 'success' | 'error' | 'warning' => {
  switch (status) {
    case AgentRunStatus.Succeeded: return 'success';
    case AgentRunStatus.Approved: return 'success';
    case AgentRunStatus.Failed: return 'error';
    case AgentRunStatus.Rejected: return 'error';
    case AgentRunStatus.Processing: return 'info';
    default: return 'default';
  }
};

export const AgentRunManagement: FC = () => {
  const navigate = useNavigate();
  const { agentRuns, approve, reject, rerun } = useListAgentRuns({ currentPageState });

  const columns: GridColDef<AgentRunListItem>[] = useMemo(() => [
    {
      field: 'actions',
      headerName: 'Actions',
      width: 180,
      sortable: false,
      filterable: false,
      renderCell: (params: GridRenderCellParams<AgentRunListItem>) => (
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          <Tooltip title="View run">
            <IconButton aria-label="View run" onClick={() => navigate(`/admin/agent-runs/detail?runId=${params.row.id}`)}>
              <VisibilityIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Approve">
            <span>
              <IconButton aria-label="Approve run" disabled={params.row.status !== AgentRunStatus.Succeeded} onClick={() => approve(params.row.id)}>
                <CheckCircleIcon sx={{ color: params.row.status === AgentRunStatus.Succeeded ? 'green' : undefined }} />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title="Reject">
            <span>
              <IconButton aria-label="Reject run" disabled={params.row.status !== AgentRunStatus.Succeeded && params.row.status !== AgentRunStatus.Failed} onClick={() => reject(params.row.id)}>
                <CancelIcon sx={{ color: 'red' }} />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title="Re-run">
            <IconButton aria-label="Re-run" onClick={() => rerun(params.row.id)}>
              <ReplayIcon />
            </IconButton>
          </Tooltip>
        </Box>
      ),
    },
    {
      field: 'status',
      headerName: 'Status',
      width: 130,
      renderCell: (params: GridRenderCellParams<AgentRunListItem>) => (
        <Chip label={params.row.status} color={statusColor(params.row.status)} size="small" />
      ),
    },
    { field: 'sourceUrl', headerName: 'Source', width: 420 },
    { field: 'model', headerName: 'Model', width: 160 },
    { field: 'createdAt', headerName: 'Created', width: 200 },
  ], [navigate, approve, reject, rerun]);

  return (
    <Box sx={{ p: 2 }}>
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 1 }}>
        <Button variant="contained" color="success" onClick={() => navigate('/admin/agent-runs/new')}>
          New agent run
        </Button>
      </Box>
      <DataGrid
        rows={agentRuns}
        columns={columns}
        getRowId={(row) => row.id}
        autoHeight
        pageSizeOptions={[25, 50, 100]}
      />
    </Box>
  );
};
