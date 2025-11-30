import { useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { AuthContextProps, AuthProvider, useAuth } from 'react-oidc-context';
import { WebStorageStateStore } from 'oidc-client-ts';
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
import { BookmarkProvider } from './contexts/BookmarkContext';
import { ThemeProvider as MuiThemeProvider } from '@mui/material/styles';
import ReactGA from 'react-ga4';

if (environment.gaId) {
  ReactGA.initialize(environment.gaId);
}

const oidcConfig = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  authority: `${(window as any).env.API_URL!}/api/v1/connect`,
  client_id: environment.clientId,
  redirect_uri: `${window.location.origin}${environment.basePath}/callback`,
  scope: 'openid offline_access',
  automaticSilentRenew: true,
  post_logout_redirect_uri: `${window.location.origin}${environment.basePath}`,
  userStore: new WebStorageStateStore({ store: window.localStorage }),
};

export function AppWrapper() {
  const navigate = useNavigate();
  const auth = useAuth();
  const dispatch = useDispatch();
  const { theme } = useTheme();
  const isAdminOrModerator = (auth: AuthContextProps) => 
    auth.user?.profile.role === Role.Admin || auth.user?.profile.role === Role.Moderator;

  // Validate session on mount and when user changes
  useEffect(() => {
    if (!auth.user || auth.isLoading) return;
    
    const expiresAt = auth.user.expires_at;
    if (expiresAt && expiresAt < Date.now() / 1000) {
      // Token has expired, remove user immediately
      console.warn('Session expired on load, removing user');
      auth.removeUser();
    }
  }, []); // Only run once on mount

  useEffect(() => {
    ReactGA.send({ hitType: "pageview", page: "/main", title: "Main Page" });
  }, [])

  useEffect(() => {
    const sessionInfo = store.getState().sessionInfo;
    
    // Only update if state actually changed
    if (auth.isAuthenticated && auth.user) {
      if (!sessionInfo.isAuthenticated || sessionInfo.loginName !== auth.user.profile.sub) {
        dispatch(
          setSessionInfo({
            isAuthenticated: true,
            fullName: auth.user?.profile.name ?? '',
            loginName: auth.user?.profile.sub ?? '',
          }),
        );
      }
    } else if (sessionInfo.isAuthenticated) {
      // Only clear if it was previously authenticated
      dispatch(
        setSessionInfo({
          isAuthenticated: false,
          fullName: '',
          loginName: '',
        }),
      );
    }
  }, [auth.isAuthenticated, auth.user?.profile?.sub, dispatch]);

  // Set up token expiration handler once
  useEffect(() => {
    const unsubscribe = auth.events.addAccessTokenExpiring(() => {
      auth.signinSilent();
    });
    
    return unsubscribe;
  }, []);

  useEffect(() => {
    document.title = "Soroban Security Portal";
  }, []);

  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      const oidcUserKey = `oidc.user:${(window as any).env.API_URL!}/api/v1/connect:${environment.clientId}`;
      if (e.key === oidcUserKey && e.newValue === null && auth.isAuthenticated) {
        auth.removeUser().then(() => {
          if (window.location.pathname.startsWith(`${environment.basePath}/admin`)) {
            navigate('/');
          }
        });
      }
    };

    window.addEventListener('storage', handleStorageChange);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [auth.isAuthenticated, navigate]);

  // Handle navigation based on auth state and route
  useEffect(() => {
    if (auth.isLoading) return; // Don't navigate while auth is loading
    
    const path = window.location.pathname;
    
    if (path.startsWith(`${environment.basePath}/login`)) {
      if (auth.isAuthenticated) {
        const isAdmin = auth.user?.profile.role === Role.Admin || auth.user?.profile.role === Role.Moderator;
        if (isAdmin) {
          navigate(`${environment.basePath}/admin`);
        } else {
          navigate('/');
        }
      }
    } else if (path.startsWith(`${environment.basePath}/admin`)) {
      const isAdmin = auth.user?.profile.role === Role.Admin || auth.user?.profile.role === Role.Moderator;
      if (auth.isAuthenticated && !isAdmin) {
        navigate('/');
      } else if (!auth.isAuthenticated) {
        navigate('/login');
      }
    } else if (path.startsWith(`${environment.basePath}/callback`)) {
      if (auth.isAuthenticated) {
        const isAdmin = auth.user?.profile.role === Role.Admin || auth.user?.profile.role === Role.Moderator;
        if (isAdmin) {
          navigate(`${environment.basePath}/admin`);
        } else {
          navigate('/');
        }
      }
    }
  }, [auth.isAuthenticated, auth.user?.profile?.role, navigate]);

  if (window.location.pathname.startsWith(`${environment.basePath}/login`)) {
    if (auth.isAuthenticated) {
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
      return <></>;
    }
  } else if (window.location.pathname.startsWith(`${environment.basePath}/callback`)) {
      // Show loading while callback is being processed
      return (
        <MuiThemeProvider theme={theme}>
          <Authentication errorText="" isLoading={true} />
        </MuiThemeProvider>
      );
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
          <BookmarkProvider>
            <AppWrapper />
          </BookmarkProvider>
        </ThemeProvider>
      </Provider>
    </BrowserRouter>
  </AuthProvider>,
);
