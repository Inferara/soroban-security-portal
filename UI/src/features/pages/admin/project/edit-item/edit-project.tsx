import { Button, Grid, Paper, TextField } from '@mui/material';
import { styled } from '@mui/material/styles';
import { FC, useEffect, useState } from 'react';
import { ProjectItem } from '../../../../../api/soroban-security-portal/models/project.ts';
import { showError } from '../../../../dialog-handler/dialog-handler.ts';
import { CurrentPageState } from '../../admin-main-window/current-page-slice.ts';
import { useEditProject } from './hooks/index.ts';
import { useNavigate } from 'react-router-dom';
import { defaultUiSettings } from '../../../../../api/soroban-security-portal/models/ui-settings.ts';

const Item = styled(Paper)(({ theme }) => ({
  backgroundColor: theme.palette.background.paper,
  padding: '0px',
  textAlign: 'center',
  border: '0px',
  boxShadow: 'none',
}));

export const EditProject: FC = () => {
  const navigate = useNavigate();
  const [url, setUrl] = useState('');
  const [name, setName] = useState('');

  const currentPageState: CurrentPageState = {
    pageName: 'Edit Project',
    pageCode: 'editProject',
    pageUrl: window.location.pathname,
    routePath: 'admin/projects/edit',
  };
  const { editProject, project } = useEditProject({ currentPageState });

  useEffect(() => {
    setName(project?.name ?? '');
    setUrl(project?.url ?? '');
  }, [project]);

  const handleEditProject = async () => {
    if (url === '' || name === '') {
      showError('All fields are required.');
      return;
    }

    const editProjectItem = {
      name: name,
      url: url,
      id: project?.id ?? 0,
      date: project?.date ?? new Date(),
      createdBy: project?.createdBy ?? '',
    } as ProjectItem;
    const editProjectSuccess = await editProject(editProjectItem);

    if (editProjectSuccess) {
      navigate('/admin/projects');
    } else {
      showError('Project updating failed.');
    }
  };

  return (
    <div style={defaultUiSettings.editAreaStyle}>
      <Grid container spacing={2}>
        <Grid size={12} sx={{textAlign: 'center'}}>
          <h3>Edit Project</h3>
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
            <Button onClick={handleEditProject}>Save</Button>
            <Button onClick={() => history.back()}>Cancel</Button>
          </Item>
        </Grid>
      </Grid>
    </div>
  );
};
