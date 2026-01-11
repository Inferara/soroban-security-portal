import { Autocomplete, Button, FormHelperText, Grid, Stack, TextField } from '@mui/material';
import { FC, useEffect, useMemo, useState } from 'react';
import { ProtocolItem } from '../../../../../api/soroban-security-portal/models/protocol.ts';
import { showError } from '../../../../dialog-handler/dialog-handler.ts';
import { CurrentPageState } from '../../admin-main-window/current-page-slice.ts';
import { useEditProtocol } from './hooks/index.ts';
import { useNavigate } from 'react-router-dom';
import { defaultUiSettings } from '../../../../../api/soroban-security-portal/models/ui-settings.ts';
import { CompanyItem } from '../../../../../api/soroban-security-portal/models/company.ts';
import { AvatarUpload } from '../../../../../components/AvatarUpload.tsx';
import { environment } from '../../../../../environments/environment.ts';

export const EditProtocol: FC = () => {
  const navigate = useNavigate();
  const [url, setUrl] = useState('');
  const [name, setName] = useState('');
  const [company, setCompany] = useState<CompanyItem | null>(null);
  const [description, setDescription] = useState('');
  const [image, setImage] = useState<string | null>(null);

  const currentPageState: CurrentPageState = {
    pageName: 'Edit Protocol',
    pageCode: 'editProtocol',
    pageUrl: window.location.pathname,
    routePath: 'admin/protocols/edit',
  };
  const { editProtocol, protocol, companyListData } = useEditProtocol({ currentPageState });

  useEffect(() => {
    setName(protocol?.name ?? '');
    setUrl(protocol?.url ?? '');
    setCompany(companyListData.find(company => company.id === protocol?.companyId) ?? null);
    setDescription(protocol?.description ?? '');
    setImage(null); // Don't use the base64 from API, use URL instead
  }, [protocol]);

  // Construct image URL for existing protocol images with cache busting
  // Always try to load the image for existing protocols - onError will handle 404s
  const existingImageUrl = useMemo(() => {
    if (!protocol?.id) return null;
    return `${environment.apiUrl}/api/v1/protocols/${protocol.id}/image.png?t=${Date.now()}`;
  }, [protocol?.id]);

  const handleEditProtocol = async () => {
    if (url === '' || name === '') {
      showError('All fields are required.');
      return;
    }

    const editProtocolItem = {
      name: name,
      url: url,
      companyId: company?.id ?? 0,
      id: protocol?.id ?? 0,
      date: protocol?.date ?? new Date(),
      createdBy: protocol?.createdBy ?? '',
      description: description,
      image: image ?? undefined,
    } as ProtocolItem;
    const editProtocolSuccess = await editProtocol(editProtocolItem);

    if (editProtocolSuccess) {
      navigate('/admin/protocols');
    } else {
      showError('Protocol updating failed.');
    }
  };

  return (
    <div style={defaultUiSettings.editAreaStyle}>
      <Grid container spacing={2}>
        <Grid size={12} sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <AvatarUpload
            key={`protocol-avatar-${protocol?.id ?? 'new'}`}
            placeholder={name.charAt(0).toUpperCase() || 'P'}
            setImageCallback={setImage}
            initialImage={image}
            initialImageUrl={existingImageUrl}
          />
          <FormHelperText sx={{ mt: 1, textAlign: 'center' }}>
            PNG, JPG, or GIF. Max 100KB.
          </FormHelperText>
        </Grid>
        <Grid size={12} sx={{ textAlign: 'center', alignContent: 'center' }}>
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
        <Grid size={12} sx={{ textAlign: 'center', alignContent: 'center' }}>
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
        <Grid size={12} sx={{ textAlign: 'center', alignContent: 'center' }}>
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
        <Grid size={12} sx={{ textAlign: 'center', alignContent: 'center' }}>
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
        <Button onClick={handleEditProtocol}>Save</Button>
        <Button onClick={() => history.back()}>Cancel</Button>
      </Stack>
    </div>
  );
};
