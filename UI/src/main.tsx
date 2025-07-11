import { useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { AuthContextProps, AuthProvider, useAuth } from 'react-oidc-context';
import { Provider, useDispatch } from 'react-redux';
import { BrowserRouter, useNavigate } from 'react-router-dom';
import { store } from './app/store';
import { environment } from './environments/environment';
import './index.css';
import { Authentication } from './features/authentication/authentication';
import { setSessionInfo } from './features/authentication/session-info-slice';
import { AdminMainWindow } from './features/pages/admin/admin-main-window/admin-main-window';
import "@fontsource/rubik";
import "@fontsource/roboto";
import { Role } from './api/soroban-security-portal/models/role';
import { MainWindow } from './features/pages/regular/main-window/main-window';
import { ThemeProvider, useTheme } from './contexts/ThemeContext';
import { ThemeProvider as MuiThemeProvider } from '@mui/material/styles';

const oidcConfig = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  authority: `${(window as any).env.API_URL!}/api/v1/connect`,
  client_id: environment.clientId,
  redirect_uri: `${window.location.origin}${environment.basePath}/callback`,
  scope: 'openid offline_access',
  automaticSilentRenew: true,
  post_logout_redirect_uri: `${window.location.origin}${environment.basePath}`,
};

export function AppWrapper() {
  const navigate = useNavigate();
  const auth = useAuth();
  const dispatch = useDispatch();
  const { theme } = useTheme();
  const isAdminOrModerator = (auth: AuthContextProps) => 
    auth.user?.profile.role === Role.Admin || auth.user?.profile.role === Role.Moderator;

  useEffect(() => {
    const sessionInfo = store.getState().sessionInfo;
    if (!sessionInfo.isAuthenticated) {
      dispatch(
        setSessionInfo({
          isAuthenticated: true,
          fullName: auth.user?.profile.name ?? '',
          loginName: auth.user?.profile.sub ?? '',
        }),
      );
    }
    return auth.events.addAccessTokenExpiring(() => {
      auth.signinSilent();
    });
  }, [auth.events, auth.signinSilent, auth]);

  useEffect(() => {
    document.title = "Soroban Security Portal";
  }, []);

  if (window.location.pathname.startsWith(`${environment.basePath}/login`)) {
    if (auth.isAuthenticated) {
      if (isAdminOrModerator(auth)) {
        navigate(`${environment.basePath}/admin`);
      } else {
        navigate('/');
      }
      return <></>;
    }
    return (
      <MuiThemeProvider theme={theme}>
        <Authentication errorText={auth.error ? 'Login failed' : ''} isLoading={auth.isLoading} />
      </MuiThemeProvider>
    );
  }
  else if (window.location.pathname.startsWith(`${environment.basePath}/admin`)) {
    if (auth.isAuthenticated && !isAdminOrModerator(auth)) {
      navigate('/');
      return <></>;
    }
    if (auth.isAuthenticated){
      return (
          <MuiThemeProvider theme={theme}>
            <AdminMainWindow />
          </MuiThemeProvider>
        );
    }
    else {
      navigate('/login');
      return <></>;
    }
  } else if (window.location.pathname.startsWith(`${environment.basePath}/callback`)) {
      if(isAdminOrModerator(auth))
        navigate(`${environment.basePath}/admin`);
      else
        navigate('/');
      return <></>;
  } else {
    return (
      <MuiThemeProvider theme={theme}>
        <MainWindow />
      </MuiThemeProvider>
    );
  }
}

const container = document.getElementById('root');
const root = createRoot(container!);
root.render(
  <AuthProvider {...oidcConfig}>
    <BrowserRouter>
      <Provider store={store}>
        <ThemeProvider>
          <AppWrapper />
        </ThemeProvider>
      </Provider>
    </BrowserRouter>
  </AuthProvider>,
);
