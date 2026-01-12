import PersonAddIcon from '@mui/icons-material/PersonAdd';
import { Link, Typography } from '@mui/material';
import { GridColDef, GridRenderCellParams } from '@mui/x-data-grid';
import { FC, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

import { AuditorItem } from '../../../../../api/soroban-security-portal/models/auditor';
import { getAuditorListDataCall, removeAuditorCall } from '../../../../../api/soroban-security-portal/soroban-security-portal-api';
import { AdminDataGrid } from '../../../../../components/admin';
import { useAdminList } from '../../../../../hooks/admin';
import { CurrentPageState } from '../../admin-main-window/current-page-slice';

export const ListAuditors: FC = () => {
  const navigate = useNavigate();

  const currentPageState: CurrentPageState = useMemo(() => ({
    pageName: 'Auditors',
    pageCode: 'auditors',
    pageUrl: window.location.pathname,
    routePath: 'admin/auditors',
  }), []);

  const { data: auditorListData, remove: auditorRemove } = useAdminList<AuditorItem>({
    fetchData: getAuditorListDataCall,
    removeItem: removeAuditorCall,
    currentPageState,
  });

  const columnsData: GridColDef[] = useMemo(() => [
    {
      field: 'name',
      headerName: 'Auditor',
      width: 250,
      renderCell: (params: GridRenderCellParams<AuditorItem>) => (
        <Link
          sx={{
            textAlign: 'left',
            textOverflow: 'ellipsis',
            overflow: 'hidden',
            whiteSpace: 'nowrap',
          }}
          component="button"
          onClick={() => navigate(`/admin/auditors/edit?auditorId=${params.row.id}`)}
        >
          {params.row.name}
        </Link>
      ),
    },
    {
      field: 'url',
      headerName: 'URL',
      width: 250,
    },
    {
      field: 'date',
      headerName: 'Date',
      width: 250,
      renderCell: (params: GridRenderCellParams<AuditorItem>) => (
        <Typography>{params.row.date.toString().split('.')[0].replace('T', ' ')}</Typography>
      ),
    },
    {
      field: 'createdBy',
      headerName: 'Created By',
      width: 250,
    },
  ], [navigate]);

  return (
    <AdminDataGrid<AuditorItem>
      rows={auditorListData}
      columns={columnsData}
      getRowId={(row) => row.id}
      onRemove={auditorRemove}
      addButton={{
        path: '/admin/auditors/add',
        icon: <PersonAddIcon sx={{ color: 'green' }} />,
        tooltip: 'Add Auditor',
      }}
      removeAction={{
        tooltip: 'Remove Auditor',
      }}
      confirmDialog={{
        title: 'Remove Auditor',
        message: 'Are you sure you want to remove this Auditor?',
      }}
    />
  );
};
