import { Button, Grid, Stack, TextField } from '@mui/material';
import { FC, useState } from 'react';
import { TagItem } from '../../../../../api/soroban-security-portal/models/tag.ts';
import { showError } from '../../../../dialog-handler/dialog-handler.ts';
import { CurrentPageState } from '../../admin-main-window/current-page-slice.ts';
import { useAddTag } from './hooks/index.ts';
import { useNavigate } from 'react-router-dom';
import { defaultUiSettings } from '../../../../../api/soroban-security-portal/models/ui-settings.ts';
import { useAuth } from 'react-oidc-context';

export const AddTag: FC = () => {
  const navigate = useNavigate();
  const auth = useAuth();
  const [name, setName] = useState('');
  const [textColor, setTextColor] = useState('#000000');
  const [bgColor, setBgColor] = useState('#FFFFFF');

  const currentPageState: CurrentPageState = {
    pageName: 'Add Tag',
    pageCode: 'addTag',
    pageUrl: window.location.pathname,
    routePath: 'admin/tags/add',
  };
  const { addTag } = useAddTag({ currentPageState });

  const handleCreateTag = async () => {
    if (name === '') {
      showError('Name field is required.');
      return;
    }
    const createTagItem: TagItem = {
      id: 0,
      name: name,
      bgColor: bgColor,
      textColor: textColor,
      date: new Date(),
      createdBy: Number(auth.user?.profile.id || 0)
    };
    const createTagSuccess = await addTag(createTagItem);
    if (createTagSuccess) {
      navigate('/admin/tags');
    } else {
      showError('Tag creation failed. Probably tag already exists.');
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
            id="textColor"
            label="Text Color"
            value={textColor}
            onChange={(e) => setTextColor(e.target.value)}
            type="color"
            InputProps={{
              style: { height: '56px' }
            }}
          />
        </Grid>
        <Grid size={12} sx={{textAlign: 'center', alignContent: 'center'}} >   
          <TextField
            sx={{ width: defaultUiSettings.editControlSize }}
            required={true}
            id="bgColor"
            label="Background Color"
            value={bgColor}
            onChange={(e) => setBgColor(e.target.value)}
            type="color"
            InputProps={{
              style: { height: '56px' }
            }}
          />
        </Grid>
      </Grid>
      <Stack direction="row" spacing={2} justifyContent="center" sx={{ marginTop: 2 }}>
        <Button onClick={handleCreateTag}>Create Tag</Button>
        <Button onClick={() => history.back()}>Cancel</Button>
      </Stack>
    </div>
  );
};
