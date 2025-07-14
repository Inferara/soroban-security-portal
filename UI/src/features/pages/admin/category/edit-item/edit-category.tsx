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
  const [url, setUrl] = useState('');
  const [name, setName] = useState('');

  const currentPageState: CurrentPageState = {
    pageName: 'Edit Category',
    pageCode: 'editCategory',
    pageUrl: window.location.pathname,
    routePath: 'admin/categories/edit',
  };
  const { editCategory, category } = useEditCategory({ currentPageState });

  useEffect(() => {
    setName(category?.name ?? '');
    setUrl(category?.url ?? '');
  }, [category]);

  const handleEditCategory = async () => {
    if (url === '' || name === '') {
      showError('All fields are required.');
      return;
    }

    const editCategoryItem = {
      name: name,
      url: url,
      id: category?.id ?? 0,
      date: category?.date ?? new Date(),
      createdBy: category?.createdBy ?? '',
    } as CategoryItem;
    const editCategorySuccess = await editCategory(editCategoryItem);

    if (editCategorySuccess) {
      navigate('/admin/categories');
    } else {
      showError('Category updating failed.');
    }
  };

  return (
    <div style={defaultUiSettings.editAreaStyle}>
      <Grid container spacing={2}>
        <Grid size={12} sx={{textAlign: 'center'}}>
          <h3>Edit Category</h3>
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
            <Button onClick={handleEditCategory}>Save</Button>
            <Button onClick={() => history.back()}>Cancel</Button>
          </Item>
        </Grid>
      </Grid>
    </div>
  );
};
