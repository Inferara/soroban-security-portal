import { Button, Grid, Paper, TextField } from '@mui/material';
import { styled } from '@mui/material/styles';
import { FC, useState } from 'react';
import { CategoryItem } from '../../../../../api/soroban-security-portal/models/category.ts';
import { showError } from '../../../../dialog-handler/dialog-handler.ts';
import { CurrentPageState } from '../../admin-main-window/current-page-slice.ts';
import { useAddCategory } from './hooks/index.ts';
import { useNavigate } from 'react-router-dom';
import { defaultUiSettings } from '../../../../../api/soroban-security-portal/models/ui-settings.ts';

const Item = styled(Paper)(({ theme }) => ({
  backgroundColor: theme.palette.background.paper,
  padding: '0px',
  textAlign: 'center',
  border: '0px',
  boxShadow: 'none',
}));

export const AddCategory: FC = () => {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');

  const currentPageState: CurrentPageState = {
    pageName: 'Add Category',
    pageCode: 'addCategory',
    pageUrl: window.location.pathname,
    routePath: 'admin/categories/add',
  };
  const { addCategory } = useAddCategory({ currentPageState });

  const handleCreateCategory = async () => {
    if (name === '' || url === '') {
      showError('All fields are required.');
      return;
    }
    const createCategoryItem = {
      id: 0,
      name: name,
      url: url,
    } as CategoryItem;
    const createCategorySuccess = await addCategory(createCategoryItem);
    if (createCategorySuccess) {
      navigate('/admin/categories');
    } else {
      showError('Category creation failed. Probably category already exists.');
    }
  };

  return (
    <div style={defaultUiSettings.editAreaStyle}>
      <Grid container spacing={2}>
        <Grid size={12} sx={{textAlign: 'center'}} >   
          <h3>New Category</h3>
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
        <Grid size={12}>
          <Item>
            <Button onClick={handleCreateCategory}>Create Category</Button>
            <Button onClick={() => history.back()}>Cancel</Button>
          </Item>
        </Grid>
      </Grid>
    </div>
  );
};
