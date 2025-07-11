import { Button, Grid, MenuItem, Paper, Select, TextField } from '@mui/material';
import { styled } from '@mui/material/styles';
import { FC, useState } from 'react';
import { CreateUserItem } from '../../../../../api/soroban-security-portal/models/user.ts';
import { showError } from '../../../../dialog-handler/dialog-handler.ts';
import { CurrentPageState } from '../../admin-main-window/current-page-slice.ts';
import { useAddUser } from './hooks';
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

export const AddUser: FC = () => {
  const navigate = useNavigate();
  const [login, setLogin] = useState('');
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState(Role.User as string);
  const [password1, setPassword1] = useState('');
  const [password2, setPassword2] = useState('');

  const currentPageState: CurrentPageState = {
    pageName: 'Add User',
    pageCode: 'addUser',
    pageUrl: window.location.pathname,
    routePath: 'admin/users/add',
  };
  const { createUser } = useAddUser({ currentPageState });

  const handleCreateUser = async () => {
    if (password1 !== password2) {
      showError('Passwords do not match.');
      return;
    }
    if (login === '' || email === '' || fullName === '' || role === '' || password1 === '') {
      showError('All fields are required.');
      return;
    }
    const createUserItem = {
      login: login,
      email: email,
      fullName: fullName,
      role: role,
      password: password1,
      isEnabled: true,
    } as CreateUserItem;
    const createUserSuccess = await createUser(createUserItem);
    if (createUserSuccess) {
      navigate('/admin/users');
    } else {
      showError('User creation failed. Probably user already exists.');
    }
  };

  return (
    <div style={defaultUiSettings.editAreaStyle}>
      <Grid container spacing={2}>
        <Grid size={12} sx={{textAlign: 'center'}} >   
          <h3>New User</h3>
        </Grid>
        <Grid size={12} sx={{textAlign: 'center', alignContent: 'center'}} >   
          <TextField
            sx={{ width: defaultUiSettings.editControlSize }}
            required={true}
            id="login"
            label="Login"
            value={login}
            onChange={(e) => setLogin(e.target.value)}
            type="text"
          />
        </Grid>
        <Grid size={12} sx={{textAlign: 'center', alignContent: 'center'}} >   
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
        <Grid size={12} sx={{textAlign: 'center', alignContent: 'center'}}>
          <TextField
            sx={{ width: defaultUiSettings.editControlSize }}
            required={true}
            id="password-1"
            label="Password"
            autoComplete="new-password"
            value={password1}
            onChange={(e) => setPassword1(e.target.value)}
            type="password"
          />
        </Grid>
        <Grid size={12} sx={{textAlign: 'center', alignContent: 'center'}}>
          <TextField
            sx={{ width: defaultUiSettings.editControlSize }}
            required={true}
            id="password-2"
            label="Repeat Password"
            autoComplete="new-password"
            value={password2}
            onChange={(e) => setPassword2(e.target.value)}
            type="password"
          />
        </Grid>
        <Grid size={12}>
          <Item>
            <Button onClick={handleCreateUser}>Create User</Button>
            <Button onClick={() => history.back()}>Cancel</Button>
          </Item>
        </Grid>
      </Grid>
    </div>
  );
};
