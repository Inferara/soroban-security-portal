import { Button, Grid, Stack, TextField } from '@mui/material';
import { FC, useEffect, useState } from 'react';
import { TagItem } from '../../../../../api/soroban-security-portal/models/tag.ts';
import { showError } from '../../../../dialog-handler/dialog-handler.ts';
import { CurrentPageState } from '../../admin-main-window/current-page-slice.ts';
import { useEditTag } from './hooks/index.ts';
import { useNavigate } from 'react-router-dom';
import { defaultUiSettings } from '../../../../../api/soroban-security-portal/models/ui-settings.ts';

export const EditTag: FC = () => {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [textColor, setTextColor] = useState('#000000');
  const [bgColor, setBgColor] = useState('#FFFFFF');

  const currentPageState: CurrentPageState = {
    pageName: 'Edit Tag',
    pageCode: 'editTag',
    pageUrl: window.location.pathname,
    routePath: 'admin/tags/edit',
  };
  const { editTag, tag } = useEditTag({ currentPageState });

  useEffect(() => {
      setName(tag?.name ?? '');
      setBgColor(tag?.bgColor ?? '');
      setTextColor(tag?.textColor ?? '');
  }, [tag]);

  const handleEditTag = async () => {
    if (name === '') {
      showError('Name field is required.');
      return;
    }

    const editTagItem = {
      name: name,
      bgColor: bgColor,
      textColor: textColor,
      id: tag?.id ?? 0,
      date: tag?.date ?? new Date(),
      createdBy: tag?.createdBy ?? '',
    } as TagItem;
    const editTagSuccess = await editTag(editTagItem);

    if (editTagSuccess) {
      navigate('/admin/tags');
    } else {
      showError('Tag updating failed.');
    }
  };

  return (
    <div style={defaultUiSettings.editAreaStyle}>
      <Grid container spacing={2}>
        <Grid size={12} sx={{textAlign: 'center', alignContent: 'center'}}>
          <TextField
            sx={{ width: defaultUiSettings.editControlSize }}
            required={false}
            id="name"
            label="Name"
            disabled={true}
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
        <Button onClick={handleEditTag}>Save</Button>
        <Button onClick={() => history.back()}>Cancel</Button>
      </Stack>
    </div>
  );
};
