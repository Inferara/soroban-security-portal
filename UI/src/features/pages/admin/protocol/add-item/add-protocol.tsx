import { Button, Grid, TextField, Autocomplete, Stack, FormHelperText } from '@mui/material';
import { FC, useState } from 'react';
import { ProtocolItem } from '../../../../../api/soroban-security-portal/models/protocol.ts';
import { CompanyItem } from '../../../../../api/soroban-security-portal/models/company.ts';
import { showError } from '../../../../dialog-handler/dialog-handler.ts';
import { CurrentPageState } from '../../admin-main-window/current-page-slice.ts';
import { useAddProtocol } from './hooks/index.ts';
import { useNavigate } from 'react-router-dom';
import { defaultUiSettings } from '../../../../../api/soroban-security-portal/models/ui-settings.ts';
import { AvatarUpload } from '../../../../../components/AvatarUpload.tsx';

export const AddProtocol: FC = () => {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [company, setCompany] = useState<CompanyItem | null>(null);
  const [description, setDescription] = useState('');
  const [image, setImage] = useState<string | null>(null);

  const currentPageState: CurrentPageState = {
    pageName: 'Add Protocol',
    pageCode: 'addProtocol',
    pageUrl: window.location.pathname,
    routePath: 'admin/protocols/add',
  };
  const { addProtocol, companyListData } = useAddProtocol({ currentPageState });

  const handleCreateProtocol = async () => {
    if (name === '' || url === '') {
      showError('Name and URL are required.');
      return;
    }
    const createProtocolItem = {
      id: 0,
      name: name,
      url: url,
      companyId: company?.id,
      description: description,
      image: image ?? undefined,
    } as ProtocolItem;
    const createProtocolSuccess = await addProtocol(createProtocolItem);
    if (createProtocolSuccess) {
      navigate('/admin/protocols');
    } else {
      showError('Protocol creation failed. Probably protocol already exists.');
    }
  };

  return (
    <div style={defaultUiSettings.editAreaStyle}>
      <Grid container spacing={2}>
        <Grid size={12} sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <AvatarUpload
            placeholder={name.charAt(0).toUpperCase() || 'P'}
            setImageCallback={setImage}
            initialImage={null}
          />
          <FormHelperText sx={{ mt: 1, textAlign: 'center' }}>
            PNG, JPG, or GIF. Max 100KB.
          </FormHelperText>
        </Grid>
        <Grid size={12} sx={{ textAlign: 'center', alignContent: 'center' }} >
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
        <Grid size={12} sx={{ textAlign: 'center', alignContent: 'center' }} >
          <Autocomplete
            options={companyListData}
            value={company}
            onChange={(_, newValue) => setCompany(newValue)}
            getOptionLabel={(option) => (option as CompanyItem).name}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Company"
                sx={{ width: defaultUiSettings.editControlSize }}
              />
            )}
          />
        </Grid>
        <Grid size={12} sx={{ textAlign: 'center', alignContent: 'center' }} >
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
        <Grid size={12} sx={{ textAlign: 'center', alignContent: 'center' }} >
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
        <Button onClick={handleCreateProtocol}>Create Protocol</Button>
        <Button onClick={() => history.back()}>Cancel</Button>
      </Stack>
    </div>
  );
};
