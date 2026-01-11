import { Button, FormHelperText, Grid, Stack, TextField } from '@mui/material';
import { FC, useEffect, useMemo, useState } from 'react';
import { AuditorItem } from '../../../../../api/soroban-security-portal/models/auditor';
import { showError } from '../../../../dialog-handler/dialog-handler';
import { CurrentPageState } from '../../admin-main-window/current-page-slice.ts';
import { useEditAuditor } from './hooks';
import { useNavigate } from 'react-router-dom';
import { defaultUiSettings } from '../../../../../api/soroban-security-portal/models/ui-settings.ts';
import { AvatarUpload } from '../../../../../components/AvatarUpload.tsx';
import { getEntityAvatarUrl } from '../../../../../components/EntityAvatar.tsx';

export const EditAuditor: FC = () => {
  const navigate = useNavigate();
  const [url, setUrl] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [image, setImage] = useState<string | null>(null);

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
    setDescription(auditor?.description ?? '');
    setImage(null); // Don't use the base64 from API, use URL instead
  }, [auditor]);

  // Construct image URL for existing auditor images with cache busting
  const existingImageUrl = useMemo(() => {
    if (!auditor?.id) return null;
    return getEntityAvatarUrl('auditor', auditor.id, Date.now());
  }, [auditor?.id]);

  const handleEditAuditor = async () => {
    if (url === '' || name === '') {
      showError('Name and URL are required.');
      return;
    }

    const editAuditorItem = {
      name: name,
      url: url,
      description: description,
      image: image ?? undefined,
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
        <Grid size={12} sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <AvatarUpload
            key={`auditor-avatar-${auditor?.id ?? 'new'}`}
            placeholder={name.charAt(0).toUpperCase() || 'A'}
            setImageCallback={setImage}
            initialImage={image}
            initialImageUrl={existingImageUrl}
          />
          <FormHelperText sx={{ mt: 1, textAlign: 'center' }}>
            PNG, JPG, or GIF. Max 100KB.
          </FormHelperText>
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
        <Grid size={12} sx={{textAlign: 'center', alignContent: 'center'}}>
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
        <Button onClick={handleEditAuditor}>Save</Button>
        <Button onClick={() => history.back()}>Cancel</Button>
      </Stack>
    </div>
  );
};
