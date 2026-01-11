import { Button, FormHelperText, Grid, Stack, TextField } from '@mui/material';
import { FC, useState } from 'react';
import { AuditorItem } from '../../../../../api/soroban-security-portal/models/auditor.ts';
import { showError } from '../../../../dialog-handler/dialog-handler.ts';
import { CurrentPageState } from '../../admin-main-window/current-page-slice.ts';
import { useAddAuditor } from './hooks/index.ts';
import { useNavigate } from 'react-router-dom';
import { defaultUiSettings } from '../../../../../api/soroban-security-portal/models/ui-settings.ts';
import { AvatarUpload } from '../../../../../components/AvatarUpload.tsx';

export const AddAuditor: FC = () => {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [description, setDescription] = useState('');
  const [image, setImage] = useState<string | null>(null);

  const currentPageState: CurrentPageState = {
    pageName: 'Add Auditor',
    pageCode: 'addAuditor',
    pageUrl: window.location.pathname,
    routePath: 'admin/auditors/add',
  };
  const { addAuditor } = useAddAuditor({ currentPageState });

  const handleCreateAuditor = async () => {
    if (name === '' || url === '') {
      showError('Name and URL are required.');
      return;
    }
    const createAuditorItem = {
      id: 0,
      name: name,
      url: url,
      description: description,
      image: image ?? undefined,
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
        <Grid size={12} sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <AvatarUpload
            placeholder={name.charAt(0).toUpperCase() || 'A'}
            setImageCallback={setImage}
            initialImage={null}
          />
          <FormHelperText sx={{ mt: 1, textAlign: 'center' }}>
            PNG, JPG, or GIF. Max 100KB.
          </FormHelperText>
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
        <Grid size={12} sx={{textAlign: 'center', alignContent: 'center'}} >
          <TextField
            sx={{ width: defaultUiSettings.editControlSize }}
            id="description"
            label="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            type="text"
            multiline
            minRows={4}
            maxRows={10}
          />
        </Grid>
      </Grid>
      <Stack direction="row" spacing={2} justifyContent="center" sx={{ marginTop: 2 }}>
        <Button onClick={handleCreateAuditor}>Create Auditor</Button>
        <Button onClick={() => history.back()}>Cancel</Button>
      </Stack>
    </div>
  );
};
