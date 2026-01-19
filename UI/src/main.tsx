import { useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { AuthContextProps, AuthProvider, useAuth } from 'react-oidc-context';
import { WebStorageStateStore } from 'oidc-client-ts';
import { Provider } from 'react-redux';
import { BrowserRouter, useNavigate } from 'react-router-dom';
import { store } from './app/store';
import { environment } from './environments/environment';
import './index.css';
import { Authentication } from './features/authentication/authentication';
import { AdminMainWindow } from './features/pages/admin/admin-main-window/admin-main-window';
import "@fontsource/rubik";
import "@fontsource/roboto";
import { Role } from './api/soroban-security-portal/models/role';
import { MainWindow } from './features/pages/regular/main-window/main-window';
import { ThemeProvider, useTheme } from './contexts/ThemeContext';
import { BookmarkProvider } from './contexts/BookmarkContext';
import { ThemeProvider as MuiThemeProvider } from '@mui/material/styles';
import ReactGA from 'react-ga4';
import { AUTH_FAILURE_EVENT } from './api/rest-api';
import { SessionExpirationWarning } from './components/SessionExpirationWarning';

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
      const oidcUserKey = `oidc.user:${window.env.API_URL}/api/v1/connect:${environment.clientId}`;
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

  // Handle API 401 errors by clearing session
  useEffect(() => {
    const handleAuthFailure = async () => {
      const oidcStorageKey = `oidc.user:${environment.apiUrl}/api/v1/connect:${environment.clientId}`;
      localStorage.removeItem(oidcStorageKey);
      await auth.removeUser();

      if (window.location.pathname.startsWith(`${environment.basePath}/admin`)) {
        navigate('/login');
      }
    };

    window.addEventListener(AUTH_FAILURE_EVENT, handleAuthFailure);
    return () => window.removeEventListener(AUTH_FAILURE_EVENT, handleAuthFailure);
  }, [auth, navigate]);

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
    // Show loading state while auth is initializing
    if (auth.isLoading) {
      return (
        <MuiThemeProvider theme={theme}>
          <Authentication errorText="" isLoading={true} />
        </MuiThemeProvider>
      );
    }
    // Already authenticated users will be redirected by useEffect above
    if (auth.isAuthenticated) {
      return (
        <MuiThemeProvider theme={theme}>
          <Authentication errorText="" isLoading={true} />
        </MuiThemeProvider>
      );
    }
    return (
      <MuiThemeProvider theme={theme}>
        <Authentication errorText={auth.error ? 'Login failed' : ''} isLoading={false} />
      </MuiThemeProvider>
    );
  }
  else if (window.location.pathname.startsWith(`${environment.basePath}/admin`)) {
    // Show loading state while auth is initializing
    if (auth.isLoading) {
      return (
        <MuiThemeProvider theme={theme}>
          <Authentication errorText="" isLoading={true} />
        </MuiThemeProvider>
      );
    }
    
    // Check authorization after loading is complete
    if (auth.isAuthenticated && !isAdminOrModerator(auth)) {
      // Non-admin authenticated user - will be redirected by useEffect
      return (
        <MuiThemeProvider theme={theme}>
          <Authentication errorText="" isLoading={true} />
        </MuiThemeProvider>
      );
    }
    
    if (auth.isAuthenticated){
      return (
          <MuiThemeProvider theme={theme}>
            <AdminMainWindow />
            <SessionExpirationWarning warningThresholdSeconds={120} />
          </MuiThemeProvider>
        );
    }
    else {
      // Unauthenticated user - will be redirected to login by useEffect
      return (
        <MuiThemeProvider theme={theme}>
          <Authentication errorText="" isLoading={true} />
        </MuiThemeProvider>
      );
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
        {auth.isAuthenticated && <SessionExpirationWarning warningThresholdSeconds={120} />}
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
