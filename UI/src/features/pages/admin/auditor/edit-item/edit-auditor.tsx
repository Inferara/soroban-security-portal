import { Button, Grid, Paper, TextField } from '@mui/material';
import { styled } from '@mui/material/styles';
import { FC, useEffect, useState } from 'react';
import { AuditorItem } from '../../../../../api/soroban-security-portal/models/auditor';
import { showError } from '../../../../dialog-handler/dialog-handler';
import { CurrentPageState } from '../../admin-main-window/current-page-slice.ts';
import { useEditAuditor } from './hooks';
import { useNavigate } from 'react-router-dom';
import { defaultUiSettings } from '../../../../../api/soroban-security-portal/models/ui-settings.ts';

const Item = styled(Paper)(({ theme }) => ({
  backgroundColor: theme.palette.background.paper,
  padding: '0px',
  textAlign: 'center',
  border: '0px',
  boxShadow: 'none',
}));

export const EditAuditor: FC = () => {
  const navigate = useNavigate();
  const [url, setUrl] = useState('');
  const [name, setName] = useState('');

  const currentPageState: CurrentPageState = {
    pageName: 'Edit Auditor',
    pageCode: 'editAuditor',
    pageUrl: window.location.pathname,
    routePath: 'admin/auditors/edit',
  };
  const { editAuditor, auditor } = useEditAuditor({ currentPageState });

  useEffect(() => {
    setName(auditor?.name ?? '');
    setUrl(auditor?.url ?? '');
  }, [auditor]);

  const handleEditAuditor = async () => {
    if (url === '' || name === '') {
      showError('All fields are required.');
      return;
    }

    const editAuditorItem = {
      name: name,
      url: url,
      id: auditor?.id ?? 0,
      date: auditor?.date ?? new Date(),
      createdBy: auditor?.createdBy ?? '',
    } as AuditorItem;
    const editAuditorSuccess = await editAuditor(editAuditorItem);

    if (editAuditorSuccess) {
      navigate('/admin/auditors');
    } else {
      showError('Auditor updating failed.');
    }
  };

  return (
    <div style={defaultUiSettings.editAreaStyle}>
      <Grid container spacing={2}>
        <Grid size={12} sx={{textAlign: 'center'}}>
          <h3>Edit Auditor</h3>
        </Grid>
        <Grid size={12} sx={{textAlign: 'center', alignContent: 'center'}}>
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
            <Button onClick={handleEditAuditor}>Save</Button>
            <Button onClick={() => history.back()}>Cancel</Button>
          </Item>
        </Grid>
      </Grid>
    </div>
  );
};
