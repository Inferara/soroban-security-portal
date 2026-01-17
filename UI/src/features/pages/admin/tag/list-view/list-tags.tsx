import PersonAddIcon from '@mui/icons-material/PersonAdd';
import { Chip, Link, Typography } from '@mui/material';
import { GridRenderCellParams } from '@mui/x-data-grid';
import { FC, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

import { TagItem } from '../../../../../api/soroban-security-portal/models/tag';
import { getTagsCall, removeTagCall } from '../../../../../api/soroban-security-portal/soroban-security-portal-api';
import { AdminDataGrid, ResponsiveColumn } from '../../../../../components/admin';
import { useAdminList } from '../../../../../hooks/admin';
import { CurrentPageState } from '../../admin-main-window/current-page-slice';

export const ListTags: FC = () => {
  const navigate = useNavigate();

  const currentPageState: CurrentPageState = useMemo(() => ({
    pageName: 'Tags',
    pageCode: 'tags',
    pageUrl: window.location.pathname,
    routePath: 'admin/tags',
  }), []);

  const { data: tagListData, remove: tagRemove } = useAdminList<TagItem>({
    fetchData: getTagsCall,
    removeItem: removeTagCall,
    currentPageState,
  });

  const columnsData: ResponsiveColumn[] = useMemo(() => [
    {
      field: 'name',
      headerName: 'Tag',
      width: 250,
      mobileWidth: 150,
      priority: 'essential',
      renderCell: (params: GridRenderCellParams<TagItem>) => (
        <Link
          sx={{
            textAlign: 'left',
            textOverflow: 'ellipsis',
            overflow: 'hidden',
            whiteSpace: 'nowrap',
          }}
          component="button"
          onClick={() => navigate(`/admin/tags/edit?tagId=${params.row.id}`)}
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
    },
    {
      field: 'date',
      headerName: 'Date',
      width: 250,
      priority: 'optional',
      hideOnMobile: true,
      hideOnTablet: true,
      renderCell: (params: GridRenderCellParams<TagItem>) => (
        <Typography>{params.row.date.toString().split('.')[0].replace('T', ' ')}</Typography>
      ),
    },
    {
      field: 'createdBy',
      headerName: 'Created By',
      width: 250,
      priority: 'optional',
      hideOnMobile: true,
      hideOnTablet: true,
    },
  ], [navigate]);

  return (
    <AdminDataGrid<TagItem>
      rows={tagListData}
      columns={columnsData}
      getRowId={(row) => row.id}
      onRemove={tagRemove}
      addButton={{
        path: '/admin/tags/add',
        icon: <PersonAddIcon sx={{ color: 'green' }} />,
        tooltip: 'Add Tag',
      }}
      removeAction={{
        tooltip: 'Remove Tag',
      }}
      confirmDialog={{
        title: 'Remove Tag',
        message: 'Are you sure you want to remove this Tag?',
      }}
    />
  );
};
