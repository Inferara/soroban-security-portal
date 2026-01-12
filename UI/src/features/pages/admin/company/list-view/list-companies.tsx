import AddBusinessIcon from '@mui/icons-material/AddBusiness';
import { Link, Typography } from '@mui/material';
import { GridColDef, GridRenderCellParams } from '@mui/x-data-grid';
import { FC, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

import { CompanyItem } from '../../../../../api/soroban-security-portal/models/company';
import { getCompanyListDataCall, removeCompanyCall } from '../../../../../api/soroban-security-portal/soroban-security-portal-api';
import { AdminDataGrid } from '../../../../../components/admin';
import { useAdminList } from '../../../../../hooks/admin';
import { CurrentPageState } from '../../admin-main-window/current-page-slice';

export const ListCompanies: FC = () => {
  const navigate = useNavigate();

  const currentPageState: CurrentPageState = useMemo(() => ({
    pageName: 'Companies',
    pageCode: 'companies',
    pageUrl: window.location.pathname,
    routePath: 'admin/companies',
  }), []);

  const { data: companyListData, remove: companyRemove } = useAdminList<CompanyItem>({
    fetchData: getCompanyListDataCall,
    removeItem: removeCompanyCall,
    currentPageState,
  });

  const columnsData: GridColDef[] = useMemo(() => [
    {
      field: 'name',
      headerName: 'Company',
      width: 250,
      renderCell: (params: GridRenderCellParams<CompanyItem>) => (
        <Link
          sx={{
            textAlign: 'left',
            textOverflow: 'ellipsis',
            overflow: 'hidden',
            whiteSpace: 'nowrap',
          }}
          component="button"
          onClick={() => navigate(`/admin/companies/edit?companyId=${params.row.id}`)}
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
      renderCell: (params: GridRenderCellParams<CompanyItem>) => (
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
    <AdminDataGrid<CompanyItem>
      rows={companyListData}
      columns={columnsData}
      getRowId={(row) => row.id}
      onRemove={companyRemove}
      addButton={{
        path: '/admin/companies/add',
        icon: <AddBusinessIcon sx={{ color: 'green' }} />,
        tooltip: 'Add Company',
      }}
      removeAction={{
        tooltip: 'Remove Company',
      }}
      confirmDialog={{
        title: 'Remove Company',
        message: 'Are you sure you want to remove this Company?',
      }}
    />
  );
};
