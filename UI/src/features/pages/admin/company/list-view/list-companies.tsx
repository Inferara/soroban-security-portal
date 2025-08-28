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

import { CompanyItem } from '../../../../../api/soroban-security-portal/models/company.ts';
import { CurrentPageState } from '../../admin-main-window/current-page-slice.ts';
import { useListCompanies } from './hooks/index.ts';
import { ConfirmDialog } from '../../admin-main-window/confirm-dialog.tsx';
import { CustomToolbar } from '../../../../components/custom-toolbar.tsx';
import { useNavigate } from 'react-router-dom';
import { defaultUiSettings } from '../../../../../api/soroban-security-portal/models/ui-settings.ts';
import { AuthContextProps, useAuth } from 'react-oidc-context';
import { Role } from '../../../../../api/soroban-security-portal/models/role.ts';

export const ListCompanies: FC = () => {
  const auth = useAuth();
  const navigate = useNavigate();

  const isAdmin = (auth: AuthContextProps) => auth.user?.profile.role === Role.Admin;

  const currentPageState: CurrentPageState = {
    pageName: 'Companies',
    pageCode: 'companies',
    pageUrl: window.location.pathname,
    routePath: 'admin/companies',
  };

  const { companyListData, companyRemove } = useListCompanies({ currentPageState });
  const [companyIdToRemove, setCompanyIdToRemove] = useState(0);

  const removeCompanyConfirmed = async () => {
    await companyRemove(companyIdToRemove);
    setCompanyIdToRemove(0);
  };

  let columnsData: GridColDef[] = [];
  if (isAdmin(auth)) {
    columnsData.push({
      field: 'actions',
      headerName: 'Actions',
      width: 80,
      sortable: false,
      filterable: false,
      renderCell: (params: GridRenderCellParams<CompanyItem>) => (
        <Tooltip title="Remove Company">
          <IconButton onClick={() => setCompanyIdToRemove(params.row.id)}>
            <ClearIcon sx={{ color: 'red' }} />
          </IconButton>
        </Tooltip>
      ),
    } as GridColDef);
  }

  columnsData = columnsData.concat([
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
          onClick={() =>
            navigate(`/admin/companies/edit?companyId=${params.row.id}`)
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
      renderCell: (params: GridRenderCellParams<CompanyItem>) => (
        <Typography>{params.row.date.toString().split('.')[0].replace('T', ' ')}</Typography>
      ),
    } as GridColDef,
    {
      field: 'createdBy',
      headerName: 'Created By',
      width: 250,
    } as GridColDef,
  ]);

  return (
    <div style={defaultUiSettings.listAreaStyle}>
      <Stack direction="row" spacing={2}>
        <Tooltip title="Add Company">
          <IconButton onClick={() => navigate('/admin/companies/add')}>
            <PersonAddIcon sx={{ color: 'green' }} />
          </IconButton>
        </Tooltip>
      </Stack>

      <div style={{ height: 'calc(110vh - 64px)' }}>
        <DataGrid
          getRowId={(row: CompanyItem) => row.id}
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
          rows={companyListData}
          columns={columnsData}
          showToolbar={true}
          slots={{
            toolbar: CustomToolbar,
          }}
          isRowSelectable={() => false}
        />
      </div>

      <ConfirmDialog
        title="Remove Company"
        message="Are you sure you want to remove this Company?"
        okButtonText="Yes"
        cancelButtonText="No"
        onConfirm={removeCompanyConfirmed}
        onCancel={() => setCompanyIdToRemove(0)}
        show={companyIdToRemove !== 0}
      />
    </div>
  );
};
