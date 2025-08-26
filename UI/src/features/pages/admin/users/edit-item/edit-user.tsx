import { Button, Grid, MenuItem, Paper, Select, Stack, TextField } from '@mui/material';
import { styled } from '@mui/material/styles';
import { FC, useEffect, useState } from 'react';
import { EditUserItem } from '../../../../../api/soroban-security-portal/models/user';
import { showError } from '../../../../dialog-handler/dialog-handler';
import { CurrentPageState } from '../../admin-main-window/current-page-slice.ts';
import { useEditUser } from './hooks';
import { useNavigate } from 'react-router-dom';
import { defaultUiSettings } from '../../../../../api/soroban-security-portal/models/ui-settings.ts';
import { Role } from '../../../../../api/soroban-security-portal/models/role.ts';

const Item = styled(Paper)(({ theme }) => ({
  backgroundColor: theme.palette.background.paper,
  padding: '0px',
  textAlign: 'center',
  border: '0px',
  boxShadow: 'none',
}));

export const EditUser: FC = () => {
  const navigate = useNavigate();
  const [login, setLogin] = useState('');
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState('');

  const currentPageState: CurrentPageState = {
    pageName: 'Edit User',
    pageCode: 'editUser',
    pageUrl: window.location.pathname,
    routePath: 'admin/users/edit',
  };
  const { editUser, user, loginId } = useEditUser({ currentPageState });

  useEffect(() => {
    setFullName(user?.fullName ?? '');
    setLogin(user?.login ?? '');
    setEmail(user?.email ?? '');
    setRole(user?.role ?? '');
  }, [user]);

  const handleEditUser = async () => {
    if (email === '' || fullName === '' || role === '') {
      showError('All fields are required.');
      return;
    }

    const editUserItem = {
      fullName: fullName,
      email: email,
      role: role,
      isEnabled: true,
    } as EditUserItem;
    const editUserSuccess = await editUser(loginId, editUserItem);

    if (editUserSuccess) {
      navigate('/admin/users');
    } else {
      showError('User updating failed.');
    }
  };

  return (
    <div style={defaultUiSettings.editAreaStyle}>
      <Grid container spacing={2}>
        <Grid size={12} sx={{textAlign: 'center'}}>
          <h3>Edit User</h3>
        </Grid>
        <Grid size={12} sx={{textAlign: 'center', alignContent: 'center'}}>
          <TextField
            sx={{ width: defaultUiSettings.editControlSize }}
            required={false}
            id="login"
            label="Login"
            disabled={true}
            value={login}
            onChange={(e) => setLogin(e.target.value)}
            type="text"
          />
        </Grid>
        <Grid size={12} sx={{textAlign: 'center', alignContent: 'center'}}>
          <TextField
            sx={{ width: defaultUiSettings.editControlSize }}
            required={true}
            id="email"
            label="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="text"
          />
        </Grid>
        <Grid size={12} sx={{textAlign: 'center', alignContent: 'center'}}>
          <TextField
            sx={{ width: defaultUiSettings.editControlSize }}
            required={true}
            id="full-name"
            label="Full Name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            type="text"
          />
        </Grid>
        <Grid size={12} sx={{textAlign: 'center', alignContent: 'center'}}>
          <Select
            sx={{ width: defaultUiSettings.editControlSize }}
            id="role-select"
            value={role}
            onChange={(e) => setRole(e.target.value as string)}
          >
            <MenuItem value={Role.User}>User</MenuItem>
            <MenuItem value={Role.Admin}>Admin</MenuItem>
            <MenuItem value={Role.Contributor}>Contributor</MenuItem>
            <MenuItem value={Role.Moderator}>Moderator</MenuItem>
          </Select>
        </Grid>
      </Grid>
      <Stack direction="row" spacing={2} justifyContent="center" sx={{ marginTop: 2 }}>
        <Button onClick={handleEditUser}>Save</Button>
        <Button onClick={() => history.back()}>Cancel</Button>
      </Stack>
    </div>
  );
};
