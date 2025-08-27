import { Button, Grid, Stack, TextField } from '@mui/material';
import { FC, useState } from 'react';
import { CompanyItem } from '../../../../../api/soroban-security-portal/models/company.ts';
import { showError } from '../../../../dialog-handler/dialog-handler.ts';
import { CurrentPageState } from '../../admin-main-window/current-page-slice.ts';
import { useAddCompany } from './hooks/index.ts';
import { useNavigate } from 'react-router-dom';
import { defaultUiSettings } from '../../../../../api/soroban-security-portal/models/ui-settings.ts';

export const AddCompany: FC = () => {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');

  const currentPageState: CurrentPageState = {
    pageName: 'Add Company',
    pageCode: 'addCompany',
    pageUrl: window.location.pathname,
    routePath: 'admin/companies/add',
  };
  const { addCompany } = useAddCompany({ currentPageState });

  const handleCreateCompany = async () => {
    if (name === '' || url === '') {
      showError('All fields are required.');
      return;
    }
    const createCompanyItem = {
      id: 0,
      name: name,
      url: url,
    } as CompanyItem;
    const createCompanySuccess = await addCompany(createCompanyItem);
    if (createCompanySuccess) {
      navigate('/admin/companies');
    } else {
      showError('Company creation failed. Probably company already exists.');
    }
  };

  return (
    <div style={defaultUiSettings.editAreaStyle}>
      <Grid container spacing={2}>
        <Grid size={12} sx={{textAlign: 'center', alignContent: 'center'}} >   
          <TextField
            sx={{ width: defaultUiSettings.editControlSize }}
            required={true}
            id="name"
            label="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            type="text"
          />
        </Grid>
        <Grid size={12} sx={{textAlign: 'center', alignContent: 'center'}} >   
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
      </Grid>
      <Stack direction="row" spacing={2} justifyContent="center" sx={{ marginTop: 2 }}>
        <Button onClick={handleCreateCompany}>Create Company</Button>
        <Button onClick={() => history.back()}>Cancel</Button>
      </Stack>
    </div>
  );
};
