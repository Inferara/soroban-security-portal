import React, { useState } from 'react';
import { CurrentPageState } from '../admin-main-window/current-page-slice';
import { TextField, Button, Grid, Paper  } from '@mui/material'
import { useMyProfile } from './hooks';
import { useAuth } from "react-oidc-context";
import { styled } from '@mui/material/styles';
import { showError } from '../../../dialog-handler/dialog-handler';

const Item = styled(Paper)(({ theme }) => ({
  backgroundColor: theme.palette.background.paper,
  padding: '0px',
  textAlign: 'center',
  border: '0px',
  boxShadow: 'none',
}));

export const MyProfile: React.FC = () => {
  const auth = useAuth();
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const currentPageState: CurrentPageState = {
    pageName: 'My Profile',
    pageCode: 'myprofile',
    pageUrl:  window.location.pathname,
    routePath: 'myprofile',
  }

  const {
    changePassword,
  } = useMyProfile({ currentPageState });

  const handleChangePassword = async () => {
    const changePasswordSuccess = await changePassword(oldPassword, newPassword);
    if (changePasswordSuccess) {
      auth.signoutRedirect();
    } else {
      showError('Password change failed');
    }
  }

  return (
    <div style={{ height: '90vh', width: '600px', display: 'flow-root'}}>
      <Grid container spacing={2}>
        <Grid size={12}>
          <Item>
            <h3>Profile</h3>
          </Item>
        </Grid>
        <Grid size={4}>
          <Item><b>Username</b></Item>
        </Grid>
        <Grid size={8}>
          <Item>{auth.user?.profile.sub}</Item>
        </Grid>
        <Grid size={4}>
          <Item><b>Full Name</b></Item>
        </Grid>
        <Grid size={8}>
          <Item>{auth.user?.profile.name}</Item>
        </Grid>
        <Grid size={4}>
          <Item><b>Role</b></Item>
        </Grid>
        <Grid size={8}>
          <Item>{auth.user?.profile.role as React.ReactNode}</Item>
        </Grid>
        <Grid size={4}>
          <Item><b>Login Type</b></Item>
        </Grid>
        <Grid size={8}>
          <Item>{auth.user?.profile.loginType as React.ReactNode}</Item>
        </Grid>
        {
          auth.user?.profile.loginType === "Password" ?
            <>
              <Grid size={12}>
                <Item>
                  <h3>Change Password</h3>
                </Item>
              </Grid>
              <Grid size={12}>
                <Item>
                  <TextField 
                    id="old-password" 
                    label="Old Password" 
                    autoComplete="current-password"
                    value={oldPassword}
                    onChange={(e) => setOldPassword(e.target.value)}
                    type="password"
                    >
                  </TextField>
                </Item>
              </Grid>
              <Grid size={12}>
                <Item>
                  <TextField 
                    id="new-password" 
                    label="New Password" 
                    autoComplete="new-password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    type="password"
                    >
                  </TextField>
                </Item>
              </Grid>
              <Grid size={12}>
                <Item>
                  <Button onClick={handleChangePassword}>Change Password</Button>
                </Item>
              </Grid>
            </>
            :<></>
        }        
      </Grid>
      
    </div>
  );
}