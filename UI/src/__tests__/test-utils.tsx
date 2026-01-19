import { ReactElement, ReactNode } from 'react';
import { render, RenderOptions, RenderResult } from '@testing-library/react';
import { Provider } from 'react-redux';
import { BrowserRouter, MemoryRouter } from 'react-router-dom';
import { configureStore, EnhancedStore } from '@reduxjs/toolkit';
import { ThemeProvider as MuiThemeProvider, createTheme } from '@mui/material/styles';
import { AuthContext, AuthContextProps } from 'react-oidc-context';
import { vi } from 'vitest';

import currentPageReducer from '../features/pages/admin/admin-main-window/current-page-slice';
import currentErrorReducer from '../features/pages/admin/admin-main-window/current-error-slice';
import { ThemeProvider } from '../contexts/ThemeContext';
import { BookmarkProvider } from '../contexts/BookmarkContext';

// Default MUI theme for testing
const defaultTheme = createTheme();

// Default mock auth context
export const createMockAuth = (overrides: Partial<AuthContextProps> = {}): AuthContextProps => ({
  isAuthenticated: false,
  isLoading: false,
  user: null,
  activeNavigator: undefined,
  signinRedirect: vi.fn(),
  signinSilent: vi.fn(),
  signinPopup: vi.fn(),
  signoutRedirect: vi.fn(),
  signoutPopup: vi.fn(),
  signoutSilent: vi.fn(),
  removeUser: vi.fn(),
  revokeTokens: vi.fn(),
  clearStaleState: vi.fn(),
  querySessionStatus: vi.fn(),
  startSilentRenew: vi.fn(),
  stopSilentRenew: vi.fn(),
  settings: {} as AuthContextProps['settings'],
  events: {
    addAccessTokenExpired: vi.fn(),
    removeAccessTokenExpired: vi.fn(),
    addAccessTokenExpiring: vi.fn(),
    removeAccessTokenExpiring: vi.fn(),
    addSilentRenewError: vi.fn(),
    removeSilentRenewError: vi.fn(),
    addUserLoaded: vi.fn(),
    removeUserLoaded: vi.fn(),
    addUserUnloaded: vi.fn(),
    removeUserUnloaded: vi.fn(),
    addUserSignedIn: vi.fn(),
    removeUserSignedIn: vi.fn(),
    addUserSignedOut: vi.fn(),
    removeUserSignedOut: vi.fn(),
    addUserSessionChanged: vi.fn(),
    removeUserSessionChanged: vi.fn(),
  } as AuthContextProps['events'],
  ...overrides,
});

// Create authenticated mock user
export const createAuthenticatedUser = (overrides: Partial<AuthContextProps['user']> = {}) => ({
  access_token: 'test-access-token',
  token_type: 'Bearer',
  profile: {
    sub: '1',
    name: 'Test User',
    email: 'test@example.com',
    role: 'Admin',
    ...overrides?.profile,
  },
  expires_at: Date.now() / 1000 + 3600, // 1 hour from now
  expired: false,
  scopes: ['openid', 'profile', 'email'],
  ...overrides,
});

// Create test store
export const createTestStore = (preloadedState = {}) => {
  return configureStore({
    reducer: {
      currentPage: currentPageReducer,
      currentError: currentErrorReducer,
    },
    preloadedState,
  });
};

// Provider wrapper options
interface WrapperOptions {
  store?: EnhancedStore;
  auth?: AuthContextProps;
  initialEntries?: string[];
  useMemoryRouter?: boolean;
}

// Create wrapper with all providers
const createWrapper = (options: WrapperOptions = {}) => {
  const {
    store = createTestStore(),
    auth = createMockAuth(),
    initialEntries = ['/'],
    useMemoryRouter = false,
  } = options;

  const Wrapper = ({ children }: { children: ReactNode }) => {
    const Router = useMemoryRouter ? MemoryRouter : BrowserRouter;
    const routerProps = useMemoryRouter ? { initialEntries } : {};

    return (
      <Provider store={store}>
        <AuthContext.Provider value={auth}>
          <MuiThemeProvider theme={defaultTheme}>
            <ThemeProvider>
              <BookmarkProvider>
                <Router {...routerProps}>
                  {children}
                </Router>
              </BookmarkProvider>
            </ThemeProvider>
          </MuiThemeProvider>
        </AuthContext.Provider>
      </Provider>
    );
  };

  return Wrapper;
};

// Extended render options
interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  store?: EnhancedStore;
  auth?: AuthContextProps;
  initialEntries?: string[];
  useMemoryRouter?: boolean;
}

// Custom render function
export const customRender = (
  ui: ReactElement,
  options: CustomRenderOptions = {}
): RenderResult & { store: EnhancedStore } => {
  const { store = createTestStore(), auth, initialEntries, useMemoryRouter, ...renderOptions } = options;

  const wrapper = createWrapper({ store, auth, initialEntries, useMemoryRouter });

  return {
    store,
    ...render(ui, { wrapper, ...renderOptions }),
  };
};

// Render with authenticated user
export const renderWithAuth = (
  ui: ReactElement,
  options: Omit<CustomRenderOptions, 'auth'> & { user?: Partial<AuthContextProps['user']> } = {}
) => {
  const { user, ...rest } = options;
  const authUser = createAuthenticatedUser(user);
  const auth = createMockAuth({
    isAuthenticated: true,
    user: authUser as AuthContextProps['user'],
  });

  return customRender(ui, { ...rest, auth });
};

// Render with specific route
export const renderWithRoute = (
  ui: ReactElement,
  route: string,
  options: Omit<CustomRenderOptions, 'initialEntries' | 'useMemoryRouter'> = {}
) => {
  return customRender(ui, {
    ...options,
    initialEntries: [route],
    useMemoryRouter: true,
  });
};

// Re-export everything from testing-library
export * from '@testing-library/react';
export { customRender as render };

// Export user-event for interactions
export { default as userEvent } from '@testing-library/user-event';
