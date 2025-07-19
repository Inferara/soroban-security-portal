import { Button, Grid, Paper, TextField } from '@mui/material';
import { styled } from '@mui/material/styles';
import { FC, useEffect, useState } from 'react';
import { CategoryItem } from '../../../../../api/soroban-security-portal/models/category';
import { showError } from '../../../../dialog-handler/dialog-handler';
import { CurrentPageState } from '../../admin-main-window/current-page-slice.ts';
import { useEditCategory } from './hooks';
import { useNavigate } from 'react-router-dom';
import { defaultUiSettings } from '../../../../../api/soroban-security-portal/models/ui-settings.ts';

const Item = styled(Paper)(({ theme }) => ({
  backgroundColor: theme.palette.background.paper,
  padding: '0px',
  textAlign: 'center',
  border: '0px',
  boxShadow: 'none',
}));

export const EditCategory: FC = () => {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [textColor, setTextColor] = useState('#000000');
  const [bgColor, setBgColor] = useState('#FFFFFF');

  const currentPageState: CurrentPageState = {
    pageName: 'Edit Tag',
    pageCode: 'editCategory',
    pageUrl: window.location.pathname,
    routePath: 'admin/categories/edit',
  };
  const { editCategory, category } = useEditCategory({ currentPageState });

  useEffect(() => {
      setName(category?.name ?? '');
      setBgColor(category?.bgColor ?? '');
      setTextColor(category?.textColor ?? '');
  }, [category]);

  const handleEditCategory = async () => {
    if (name === '') {
      showError('Name field is required.');
      return;
    }

    const editCategoryItem = {
      name: name,
      bgColor: bgColor,
      textColor: textColor,
      id: category?.id ?? 0,
      date: category?.date ?? new Date(),
      createdBy: category?.createdBy ?? '',
    } as CategoryItem;
    const editCategorySuccess = await editCategory(editCategoryItem);

    if (editCategorySuccess) {
      navigate('/admin/categories');
    } else {
      showError('Tag updating failed.');
    }
  };

  return (
    <div style={defaultUiSettings.editAreaStyle}>
      <Grid container spacing={2}>
        <Grid size={12} sx={{textAlign: 'center'}}>
          <h3>Edit Tag</h3>
        </Grid>
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
        <Grid size={12}>
          <Item>
            <Button onClick={handleEditCategory}>Save</Button>
            <Button onClick={() => history.back()}>Cancel</Button>
          </Item>
        </Grid>
      </Grid>
    </div>
  );
};
