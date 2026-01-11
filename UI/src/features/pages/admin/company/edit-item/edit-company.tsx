import { Button, FormHelperText, Grid, Stack, TextField } from '@mui/material';
import { FC, useEffect, useMemo, useState } from 'react';
import { CompanyItem } from '../../../../../api/soroban-security-portal/models/company.ts';
import { showError } from '../../../../dialog-handler/dialog-handler.ts';
import { CurrentPageState } from '../../admin-main-window/current-page-slice.ts';
import { useEditCompany } from './hooks/index.ts';
import { useNavigate } from 'react-router-dom';
import { defaultUiSettings } from '../../../../../api/soroban-security-portal/models/ui-settings.ts';
import { AvatarUpload } from '../../../../../components/AvatarUpload.tsx';
import { getEntityAvatarUrl } from '../../../../../components/EntityAvatar.tsx';

export const EditCompany: FC = () => {
  const navigate = useNavigate();
  const [url, setUrl] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [image, setImage] = useState<string | null>(null);

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
    setDescription(company?.description ?? '');
    setImage(null); // Don't use the base64 from API, use URL instead
  }, [company]);

  // Construct image URL for existing company images with cache busting
  // Always try to load the image for existing companies - onError will handle 404s
  const existingImageUrl = useMemo(() => {
    if (!company?.id) return null;
    return getEntityAvatarUrl('company', company.id, Date.now());
  }, [company?.id]);

  const handleEditCompany = async () => {
    if (url === '' || name === '') {
      showError('Name and URL are required.');
      return;
    }

    const editCompanyItem = {
      name: name,
      url: url,
      description: description,
      image: image ?? undefined,
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
        <Grid size={12} sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <AvatarUpload
            key={`company-avatar-${company?.id ?? 'new'}`}
            placeholder={name.charAt(0).toUpperCase() || 'C'}
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
        <Button onClick={handleEditCompany}>Save</Button>
        <Button onClick={() => history.back()}>Cancel</Button>
      </Stack>
    </div>
  );
};
