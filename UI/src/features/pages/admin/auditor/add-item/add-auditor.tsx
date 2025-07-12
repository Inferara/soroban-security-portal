import { Button, Grid, Paper, TextField } from '@mui/material';
import { styled } from '@mui/material/styles';
import { FC, useState } from 'react';
import { AuditorItem } from '../../../../../api/soroban-security-portal/models/auditor.ts';
import { showError } from '../../../../dialog-handler/dialog-handler.ts';
import { CurrentPageState } from '../../admin-main-window/current-page-slice.ts';
import { useAddAuditor } from './hooks/index.ts';
import { useNavigate } from 'react-router-dom';
import { defaultUiSettings } from '../../../../../api/soroban-security-portal/models/ui-settings.ts';

const Item = styled(Paper)(({ theme }) => ({
  backgroundColor: theme.palette.background.paper,
  padding: '0px',
  textAlign: 'center',
  border: '0px',
  boxShadow: 'none',
}));

export const AddAuditor: FC = () => {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');

  const currentPageState: CurrentPageState = {
    pageName: 'Add Auditor',
    pageCode: 'addAuditor',
    pageUrl: window.location.pathname,
    routePath: 'admin/auditors/add',
  };
  const { addAuditor } = useAddAuditor({ currentPageState });

  const handleCreateAuditor = async () => {
    if (name === '' || url === '') {
      showError('All fields are required.');
      return;
    }
    const createAuditorItem = {
      id: 0,
      name: name,
      url: url,
    } as AuditorItem;
    const createAuditorSuccess = await addAuditor(createAuditorItem);
    if (createAuditorSuccess) {
      navigate('/admin/auditors');
    } else {
      showError('Auditor creation failed. Probably auditor already exists.');
    }
  };

  return (
    <div style={defaultUiSettings.editAreaStyle}>
      <Grid container spacing={2}>
        <Grid size={12} sx={{textAlign: 'center'}} >   
          <h3>New Auditor</h3>
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
            <Button onClick={handleCreateAuditor}>Create Auditor</Button>
            <Button onClick={() => history.back()}>Cancel</Button>
          </Item>
        </Grid>
      </Grid>
    </div>
  );
};
