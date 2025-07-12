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

import { ProjectItem } from '../../../../../api/soroban-security-portal/models/project.ts';
import { CurrentPageState } from '../../admin-main-window/current-page-slice.ts';
import { useListProjects } from './hooks/index.ts';
import { ConfirmDialog } from '../../admin-main-window/confirm-dialog.tsx';
import { CustomToolbar } from '../../../../components/custom-toolbar.tsx';
import { useNavigate } from 'react-router-dom';
import { defaultUiSettings } from '../../../../../api/soroban-security-portal/models/ui-settings.ts';

export const ListProjects: FC = () => {
  const navigate = useNavigate();

  const currentPageState: CurrentPageState = {
    pageName: 'Projects',
    pageCode: 'projects',
    pageUrl: window.location.pathname,
    routePath: 'admin/projects',
  };

  const { projectListData, projectRemove } = useListProjects({ currentPageState });
  const [projectIdToRemove, setProjectIdToRemove] = useState(0);

  const removeProjectConfirmed = async () => {
    await projectRemove(projectIdToRemove);
    setProjectIdToRemove(0);
  };

  const columnsData: GridColDef[] = [
    {
      field: 'actions',
      headerName: 'Actions',
      width: 80,
      sortable: false,
      filterable: false,
      renderCell: (params: GridRenderCellParams<ProjectItem>) => (
        <Tooltip title="Remove Project">
          <IconButton onClick={() => setProjectIdToRemove(params.row.id)}>
            <ClearIcon sx={{ color: 'red' }} />
          </IconButton>
        </Tooltip>
      ),
    } as GridColDef,
    {
      field: 'name',
      headerName: 'Project',
      width: 250,
      renderCell: (params: GridRenderCellParams<ProjectItem>) => (
        <Link
          sx={{
            textAlign: 'left',
            textOverflow: 'ellipsis',
            overflow: 'hidden',
            whiteSpace: 'nowrap',
          }}
          component="button"
          onClick={() =>
            navigate(`/admin/projects/edit?projectId=${params.row.id}`)
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
      renderCell: (params: GridRenderCellParams<ProjectItem>) => (
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
        <Tooltip title="Add Project">
          <IconButton onClick={() => navigate('/admin/projects/add')}>
            <PersonAddIcon sx={{ color: 'green' }} />
          </IconButton>
        </Tooltip>
      </Stack>

      <div style={{ height: 'calc(110vh - 64px)' }}>
        <DataGrid
          getRowId={(row: ProjectItem) => row.id}
          getRowHeight={() => 'auto'}
          sx={{
            '& .MuiDataGrid-cell': {
              whiteSpace: 'normal',
              display: 'grid',
              alignContent: 'center',
              minHeight: 50,
            },
          }}
          rows={projectListData}
          columns={columnsData}
          showToolbar={true}
          slots={{
            toolbar: CustomToolbar,
          }}
          isRowSelectable={() => false}
        />
      </div>

      <ConfirmDialog
        title="Remove Project"
        message="Are you sure you want to remove this Project?"
        okButtonText="Yes"
        cancelButtonText="No"
        onConfirm={removeProjectConfirmed}
        onCancel={() => setProjectIdToRemove(0)}
        show={projectIdToRemove !== 0}
      />
    </div>
  );
};
