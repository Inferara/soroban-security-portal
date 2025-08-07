import { Button, Grid, Paper, TextField } from '@mui/material';
import { styled } from '@mui/material/styles';
import { FC, useEffect, useState } from 'react';
import { CompanyItem } from '../../../../../api/soroban-security-portal/models/company.ts';
import { showError } from '../../../../dialog-handler/dialog-handler.ts';
import { CurrentPageState } from '../../admin-main-window/current-page-slice.ts';
import { useEditCompany } from './hooks/index.ts';
import { useNavigate } from 'react-router-dom';
import { defaultUiSettings } from '../../../../../api/soroban-security-portal/models/ui-settings.ts';

const Item = styled(Paper)(({ theme }) => ({
  backgroundColor: theme.palette.background.paper,
  padding: '0px',
  textAlign: 'center',
  border: '0px',
  boxShadow: 'none',
}));

export const EditCompany: FC = () => {
  const navigate = useNavigate();
  const [url, setUrl] = useState('');
  const [name, setName] = useState('');

  const currentPageState: CurrentPageState = {
    pageName: 'Edit Company',
    pageCode: 'editCompany',
    pageUrl: window.location.pathname,
    routePath: 'admin/companies/edit',
  };
  const { editCompany, company } = useEditCompany({ currentPageState });

  useEffect(() => {
    setName(company?.name ?? '');
    setUrl(company?.url ?? '');
  }, [company]);

  const handleEditCompany = async () => {
    if (url === '' || name === '') {
      showError('All fields are required.');
      return;
    }

    const editCompanyItem = {
      name: name,
      url: url,
      id: company?.id ?? 0,
      date: company?.date ?? new Date(),
      createdBy: company?.createdBy ?? '',
    } as CompanyItem;
    const editCompaniesSuccess = await editCompany(editCompanyItem);

    if (editCompaniesSuccess) {
      navigate('/admin/companies');
    } else {
      showError('Company updating failed.');
    }
  };

  return (
    <div style={defaultUiSettings.editAreaStyle}>
      <Grid container spacing={2}>
        <Grid size={12} sx={{textAlign: 'center'}}>
          <h3>Edit Company</h3>
        </Grid>
        <Grid size={12} sx={{textAlign: 'center', alignContent: 'center'}}>
          <TextField
            sx={{ width: defaultUiSettings.editControlSize }}
            required={false}
            id="name"
            label="Name"
            disabled={true}
            value={name}
            onChange={(e) => setName(e.target.value)}
            type="text"
          />
        </Grid>
        <Grid size={12} sx={{textAlign: 'center', alignContent: 'center'}}>
          <TextField
            sx={{ width: defaultUiSettings.editControlSize }}
            required={true}
            id="url"
            label="URL"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            type="text"
          />
        </Grid>
        <Grid size={12}>
          <Item>
            <Button onClick={handleEditCompany}>Save</Button>
            <Button onClick={() => history.back()}>Cancel</Button>
          </Item>
        </Grid>
      </Grid>
    </div>
  );
};
