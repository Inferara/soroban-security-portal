import { Button, Grid, Paper, TextField } from '@mui/material';
import { styled } from '@mui/material/styles';
import { FC, useState } from 'react';
import { CompanyItem } from '../../../../../api/soroban-security-portal/models/company.ts';
import { showError } from '../../../../dialog-handler/dialog-handler.ts';
import { CurrentPageState } from '../../admin-main-window/current-page-slice.ts';
import { useAddCompany } from './hooks/index.ts';
import { useNavigate } from 'react-router-dom';
import { defaultUiSettings } from '../../../../../api/soroban-security-portal/models/ui-settings.ts';

const Item = styled(Paper)(({ theme }) => ({
  backgroundColor: theme.palette.background.paper,
  padding: '0px',
  textAlign: 'center',
  border: '0px',
  boxShadow: 'none',
}));

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
        <Grid size={12} sx={{textAlign: 'center'}} >   
          <h3>New Company</h3>
        </Grid>
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
        <Grid size={12}>
          <Item>
            <Button onClick={handleCreateCompany}>Create Company</Button>
            <Button onClick={() => history.back()}>Cancel</Button>
          </Item>
        </Grid>
      </Grid>
    </div>
  );
};
