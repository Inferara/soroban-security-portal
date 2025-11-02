import PersonAddIcon from '@mui/icons-material/PersonAdd';
import ClearIcon from '@mui/icons-material/Clear';
import {
  Chip,
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

import { TagItem } from '../../../../../api/soroban-security-portal/models/tag.ts';
import { CurrentPageState } from '../../admin-main-window/current-page-slice.ts';
import { useListTags } from './hooks/index.ts';
import { ConfirmDialog } from '../../admin-main-window/confirm-dialog.tsx';
import { CustomToolbar } from '../../../../components/custom-toolbar.tsx';
import { useNavigate } from 'react-router-dom';
import { defaultUiSettings } from '../../../../../api/soroban-security-portal/models/ui-settings.ts';
import { AuthContextProps, useAuth } from 'react-oidc-context';
import { Role } from '../../../../../api/soroban-security-portal/models/role.ts';

export const ListCategories: FC = () => {
  const auth = useAuth();
  const navigate = useNavigate();
  
  const isAdmin = (auth: AuthContextProps) => auth.user?.profile.role === Role.Admin;
  
  const currentPageState: CurrentPageState = {
    pageName: 'Tags',
    pageCode: 'categories',
    pageUrl: window.location.pathname,
    routePath: 'admin/categories',
  };

  const { tagListData, tagRemove } = useListTags({ currentPageState });
  const [tagIdToRemove, setTagIdToRemove] = useState(0);

  const removeTagConfirmed = async () => {
    await tagRemove(tagIdToRemove);
    setTagIdToRemove(0);
  };

  let columnsData: GridColDef[] = [];
  if (isAdmin(auth)) {
      columnsData.push(
        {
        field: 'actions',
        headerName: 'Actions',
        width: 140,
        sortable: false,
        filterable: false,
        renderCell: (params: GridRenderCellParams<TagItem>) => (
          (<Tooltip title="Remove Tag">
            <IconButton onClick={() => setTagIdToRemove(params.row.id)}>
              <ClearIcon sx={{ color: 'red' }} />
            </IconButton>
          </Tooltip>)
        ),
      } as GridColDef
    )
  }

  columnsData.push(
    {
      field: 'name',
      headerName: 'Tag',
      width: 250,
      renderCell: (params: GridRenderCellParams<TagItem>) => (
        <Link
          sx={{
            textAlign: 'left',
            textOverflow: 'ellipsis',
            overflow: 'hidden',
            whiteSpace: 'nowrap',
          }}
          component="button"
          onClick={() =>
            navigate(`/admin/tags/edit?tagId=${params.row.id}`)
          }
        >
          <Chip
            label={params.row.name}
            size="medium"
            sx={{
              fontSize: '16px',
              bgcolor: params.row.bgColor,
              color: params.row.textColor,
              fontWeight: 700,
            }}
          />
        </Link>
      ),
    } as GridColDef,
    {
      field: 'date',
      headerName: 'Date',
      width: 250,
      renderCell: (params: GridRenderCellParams<TagItem>) => (
        <Typography>{params.row.date.toString().split('.')[0].replace('T', ' ')}</Typography>
      ),
    } as GridColDef,
    {
      field: 'createdBy',
      headerName: 'Created By',
      width: 250,
    } as GridColDef,
  );

  return (
    <div style={defaultUiSettings.listAreaStyle}>
      <Stack direction="row" spacing={2}>
        <Tooltip title="Add Tag">
          <IconButton onClick={() => navigate('/admin/categories/add')}>
            <PersonAddIcon sx={{ color: 'green' }} />
          </IconButton>
        </Tooltip>
      </Stack>

      <div style={{ height: 'calc(110vh - 64px)' }}>
        <DataGrid
          getRowId={(row: TagItem) => row.id}
          getRowHeight={() => 'auto'}
          sx={{
            backgroundColor: 'transparent',
            '& .MuiDataGrid-cell': {
              whiteSpace: 'normal',
              display: 'grid',
              alignContent: 'center',
              minHeight: 50,
            },
          }}
          rows={tagListData}
          columns={columnsData}
          showToolbar={true}
          slots={{
            toolbar: CustomToolbar,
          }}
          isRowSelectable={() => false}
        />
      </div>

      <ConfirmDialog
        title="Remove Tag"
        message="Are you sure you want to remove this Tag?"
        okButtonText="Yes"
        cancelButtonText="No"
        onConfirm={removeTagConfirmed}
        onCancel={() => setTagIdToRemove(0)}
        show={tagIdToRemove !== 0}
      />
    </div>
  );
};
