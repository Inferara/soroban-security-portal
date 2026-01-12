import AddToQueueIcon from '@mui/icons-material/AddToQueue';
import { Link, Typography } from '@mui/material';
import { GridColDef, GridRenderCellParams } from '@mui/x-data-grid';
import { FC, useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { CompanyItem } from '../../../../../api/soroban-security-portal/models/company';
import { ProtocolItem } from '../../../../../api/soroban-security-portal/models/protocol';
import {
  getCompanyListDataCall,
  getProtocolListDataCall,
  removeProtocolCall,
} from '../../../../../api/soroban-security-portal/soroban-security-portal-api';
import { AdminDataGrid } from '../../../../../components/admin';
import { useAdminList } from '../../../../../hooks/admin';
import { CurrentPageState } from '../../admin-main-window/current-page-slice';

export const ListProtocols: FC = () => {
  const navigate = useNavigate();
  const [companyListData, setCompanyListData] = useState<CompanyItem[]>([]);

  const currentPageState: CurrentPageState = useMemo(() => ({
    pageName: 'Protocols',
    pageCode: 'protocols',
    pageUrl: window.location.pathname,
    routePath: 'admin/protocols',
  }), []);

  const { data: protocolListData, remove: protocolRemove } = useAdminList<ProtocolItem>({
    fetchData: getProtocolListDataCall,
    removeItem: removeProtocolCall,
    currentPageState,
  });

  // Fetch company data for display
  const fetchCompanyData = useCallback(async () => {
    const companies = await getCompanyListDataCall();
    setCompanyListData(companies);
  }, []);

  useEffect(() => {
    void fetchCompanyData();
  }, [fetchCompanyData]);

  const columnsData: GridColDef[] = useMemo(() => [
    {
      field: 'name',
      headerName: 'Protocol',
      width: 250,
      renderCell: (params: GridRenderCellParams<ProtocolItem>) => (
        <Link
          sx={{
            textAlign: 'left',
            textOverflow: 'ellipsis',
            overflow: 'hidden',
            whiteSpace: 'nowrap',
          }}
          component="button"
          onClick={() => navigate(`/admin/protocols/edit?protocolId=${params.row.id}`)}
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
      field: 'companyId',
      headerName: 'Company',
      width: 250,
      renderCell: (params: GridRenderCellParams<ProtocolItem>) => (
        <Typography>
          {companyListData.find((company) => company.id === params.row.companyId)?.name}
        </Typography>
      ),
    },
    {
      field: 'date',
      headerName: 'Date',
      width: 250,
      renderCell: (params: GridRenderCellParams<ProtocolItem>) => (
        <Typography>{params.row.date.toString().split('.')[0].replace('T', ' ')}</Typography>
      ),
    },
    {
      field: 'createdBy',
      headerName: 'Created By',
      width: 250,
    },
  ], [navigate, companyListData]);

  return (
    <AdminDataGrid<ProtocolItem>
      rows={protocolListData}
      columns={columnsData}
      getRowId={(row) => row.id}
      onRemove={protocolRemove}
      addButton={{
        path: '/admin/protocols/add',
        icon: <AddToQueueIcon sx={{ color: 'green' }} />,
        tooltip: 'Add Protocol',
      }}
      removeAction={{
        tooltip: 'Remove Protocol',
      }}
      confirmDialog={{
        title: 'Remove Protocol',
        message: 'Are you sure you want to remove this Protocol?',
      }}
    />
  );
};
