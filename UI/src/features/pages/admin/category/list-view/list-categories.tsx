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

import { CategoryItem } from '../../../../../api/soroban-security-portal/models/category.ts';
import { CurrentPageState } from '../../admin-main-window/current-page-slice.ts';
import { useListCategories } from './hooks/index.ts';
import { ConfirmDialog } from '../../admin-main-window/confirm-dialog.tsx';
import { CustomToolbar } from '../../../../components/custom-toolbar.tsx';
import { useNavigate } from 'react-router-dom';
import { defaultUiSettings } from '../../../../../api/soroban-security-portal/models/ui-settings.ts';

export const ListCategories: FC = () => {
  const navigate = useNavigate();

  const currentPageState: CurrentPageState = {
    pageName: 'Categories',
    pageCode: 'categories',
    pageUrl: window.location.pathname,
    routePath: 'admin/categories',
  };

  const { categoryListData, categoryRemove } = useListCategories({ currentPageState });
  const [categoryIdToRemove, setCategoryIdToRemove] = useState(0);

  const removeCategoryConfirmed = async () => {
    await categoryRemove(categoryIdToRemove);
    setCategoryIdToRemove(0);
  };

  const columnsData: GridColDef[] = [
    {
      field: 'actions',
      headerName: 'Actions',
      width: 140,
      sortable: false,
      filterable: false,
      renderCell: (params: GridRenderCellParams<CategoryItem>) => (
        <Tooltip title="Remove Tag">
          <IconButton onClick={() => setCategoryIdToRemove(params.row.id)}>
            <ClearIcon sx={{ color: 'red' }} />
          </IconButton>
        </Tooltip>
      ),
    } as GridColDef,
    {
      field: 'name',
      headerName: 'Tag',
      width: 250,
      renderCell: (params: GridRenderCellParams<CategoryItem>) => (
        <Link
          sx={{
            textAlign: 'left',
            textOverflow: 'ellipsis',
            overflow: 'hidden',
            whiteSpace: 'nowrap',
          }}
          component="button"
          onClick={() =>
            navigate(`/admin/categories/edit?categoryId=${params.row.id}`)
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
      renderCell: (params: GridRenderCellParams<CategoryItem>) => (
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
        <Tooltip title="Add Tag">
          <IconButton onClick={() => navigate('/admin/categories/add')}>
            <PersonAddIcon sx={{ color: 'green' }} />
          </IconButton>
        </Tooltip>
      </Stack>

      <div style={{ height: 'calc(110vh - 64px)' }}>
        <DataGrid
          getRowId={(row: CategoryItem) => row.id}
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
          rows={categoryListData}
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
        onConfirm={removeCategoryConfirmed}
        onCancel={() => setCategoryIdToRemove(0)}
        show={categoryIdToRemove !== 0}
      />
    </div>
  );
};
