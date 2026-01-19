import { describe, it, expect, vi } from 'vitest';
import { AuthContextProps } from 'react-oidc-context';
import {
  isValidRole,
  getUserRole,
  isAdmin,
  isModerator,
  isContributor,
  isAdminOrModerator,
  canEdit,
  canAddReport,
  isAuthorized,
  hasAccessToken,
} from '../authPermissions';
import { Role } from '../../../api/soroban-security-portal/models/role';

// Helper to create mock auth context
const createMockAuth = (overrides: Partial<AuthContextProps> = {}): AuthContextProps => ({
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
  events: {} as AuthContextProps['events'],
  ...overrides,
});

// Helper to create authenticated mock with specific role
const createAuthenticatedMock = (role: Role): AuthContextProps =>
  createMockAuth({
    isAuthenticated: true,
    user: {
      access_token: 'test-token',
      token_type: 'Bearer',
      profile: {
        sub: '1',
        name: 'Test User',
        email: 'test@example.com',
        role: role,
      },
      expires_at: Date.now() / 1000 + 3600,
      expired: false,
      scopes: ['openid'],
    } as AuthContextProps['user'],
  });

describe('authPermissions', () => {
  describe('isValidRole', () => {
    it('returns true for Admin role', () => {
      expect(isValidRole(Role.Admin)).toBe(true);
    });

    it('returns true for Moderator role', () => {
      expect(isValidRole(Role.Moderator)).toBe(true);
    });

    it('returns true for Contributor role', () => {
      expect(isValidRole(Role.Contributor)).toBe(true);
    });

    it('returns true for Viewer role', () => {
      expect(isValidRole(Role.User)).toBe(true);
    });

    it('returns false for invalid role string', () => {
      expect(isValidRole('SuperAdmin')).toBe(false);
      expect(isValidRole('InvalidRole')).toBe(false);
    });

    it('returns false for non-string values', () => {
      expect(isValidRole(null)).toBe(false);
      expect(isValidRole(undefined)).toBe(false);
      expect(isValidRole(123)).toBe(false);
      expect(isValidRole({})).toBe(false);
    });

    it('returns false for empty string', () => {
      expect(isValidRole('')).toBe(false);
    });
  });

  describe('getUserRole', () => {
    it('returns null for unauthenticated user', () => {
      const auth = createMockAuth({ isAuthenticated: false });
      expect(getUserRole(auth)).toBeNull();
    });

    it('returns null when user is null', () => {
      const auth = createMockAuth({ isAuthenticated: true, user: null });
      expect(getUserRole(auth)).toBeNull();
    });

    it('returns Admin role for admin user', () => {
      const auth = createAuthenticatedMock(Role.Admin);
      expect(getUserRole(auth)).toBe(Role.Admin);
    });

    it('returns Moderator role for moderator user', () => {
      const auth = createAuthenticatedMock(Role.Moderator);
      expect(getUserRole(auth)).toBe(Role.Moderator);
    });

    it('returns Contributor role for contributor user', () => {
      const auth = createAuthenticatedMock(Role.Contributor);
      expect(getUserRole(auth)).toBe(Role.Contributor);
    });

    it('returns Viewer role for viewer user', () => {
      const auth = createAuthenticatedMock(Role.User);
      expect(getUserRole(auth)).toBe(Role.User);
    });

    it('returns null for invalid role', () => {
      const auth = createMockAuth({
        isAuthenticated: true,
        user: {
          access_token: 'test-token',
          profile: {
            sub: '1',
            role: 'InvalidRole',
          },
        } as AuthContextProps['user'],
      });
      expect(getUserRole(auth)).toBeNull();
    });
  });

  describe('isAdmin', () => {
    it('returns true for admin user', () => {
      const auth = createAuthenticatedMock(Role.Admin);
      expect(isAdmin(auth)).toBe(true);
    });

    it('returns false for moderator user', () => {
      const auth = createAuthenticatedMock(Role.Moderator);
      expect(isAdmin(auth)).toBe(false);
    });

    it('returns false for contributor user', () => {
      const auth = createAuthenticatedMock(Role.Contributor);
      expect(isAdmin(auth)).toBe(false);
    });

    it('returns false for viewer user', () => {
      const auth = createAuthenticatedMock(Role.User);
      expect(isAdmin(auth)).toBe(false);
    });

    it('returns false for unauthenticated user', () => {
      const auth = createMockAuth({ isAuthenticated: false });
      expect(isAdmin(auth)).toBe(false);
    });
  });

  describe('isModerator', () => {
    it('returns true for moderator user', () => {
      const auth = createAuthenticatedMock(Role.Moderator);
      expect(isModerator(auth)).toBe(true);
    });

    it('returns false for admin user', () => {
      const auth = createAuthenticatedMock(Role.Admin);
      expect(isModerator(auth)).toBe(false);
    });

    it('returns false for contributor user', () => {
      const auth = createAuthenticatedMock(Role.Contributor);
      expect(isModerator(auth)).toBe(false);
    });

    it('returns false for unauthenticated user', () => {
      const auth = createMockAuth({ isAuthenticated: false });
      expect(isModerator(auth)).toBe(false);
    });
  });

  describe('isContributor', () => {
    it('returns true for contributor user', () => {
      const auth = createAuthenticatedMock(Role.Contributor);
      expect(isContributor(auth)).toBe(true);
    });

    it('returns false for admin user', () => {
      const auth = createAuthenticatedMock(Role.Admin);
      expect(isContributor(auth)).toBe(false);
    });

    it('returns false for moderator user', () => {
      const auth = createAuthenticatedMock(Role.Moderator);
      expect(isContributor(auth)).toBe(false);
    });

    it('returns false for unauthenticated user', () => {
      const auth = createMockAuth({ isAuthenticated: false });
      expect(isContributor(auth)).toBe(false);
    });
  });

  describe('isAdminOrModerator', () => {
    it('returns true for admin user', () => {
      const auth = createAuthenticatedMock(Role.Admin);
      expect(isAdminOrModerator(auth)).toBe(true);
    });

    it('returns true for moderator user', () => {
      const auth = createAuthenticatedMock(Role.Moderator);
      expect(isAdminOrModerator(auth)).toBe(true);
    });

    it('returns false for contributor user', () => {
      const auth = createAuthenticatedMock(Role.Contributor);
      expect(isAdminOrModerator(auth)).toBe(false);
    });

    it('returns false for viewer user', () => {
      const auth = createAuthenticatedMock(Role.User);
      expect(isAdminOrModerator(auth)).toBe(false);
    });

    it('returns false for unauthenticated user', () => {
      const auth = createMockAuth({ isAuthenticated: false });
      expect(isAdminOrModerator(auth)).toBe(false);
    });
  });

  describe('canEdit', () => {
    it('returns true for admin user', () => {
      const auth = createAuthenticatedMock(Role.Admin);
      expect(canEdit(auth)).toBe(true);
    });

    it('returns true for moderator user', () => {
      const auth = createAuthenticatedMock(Role.Moderator);
      expect(canEdit(auth)).toBe(true);
    });

    it('returns true for contributor user', () => {
      const auth = createAuthenticatedMock(Role.Contributor);
      expect(canEdit(auth)).toBe(true);
    });

    it('returns false for viewer user', () => {
      const auth = createAuthenticatedMock(Role.User);
      expect(canEdit(auth)).toBe(false);
    });

    it('returns false for unauthenticated user', () => {
      const auth = createMockAuth({ isAuthenticated: false });
      expect(canEdit(auth)).toBe(false);
    });
  });

  describe('canAddReport', () => {
    it('returns same result as canEdit', () => {
      const adminAuth = createAuthenticatedMock(Role.Admin);
      const moderatorAuth = createAuthenticatedMock(Role.Moderator);
      const contributorAuth = createAuthenticatedMock(Role.Contributor);
      const viewerAuth = createAuthenticatedMock(Role.User);

      expect(canAddReport(adminAuth)).toBe(canEdit(adminAuth));
      expect(canAddReport(moderatorAuth)).toBe(canEdit(moderatorAuth));
      expect(canAddReport(contributorAuth)).toBe(canEdit(contributorAuth));
      expect(canAddReport(viewerAuth)).toBe(canEdit(viewerAuth));
    });

    it('returns true for contributor (main use case)', () => {
      const auth = createAuthenticatedMock(Role.Contributor);
      expect(canAddReport(auth)).toBe(true);
    });
  });

  describe('isAuthorized', () => {
    it('returns true for authenticated user with role', () => {
      const auth = createAuthenticatedMock(Role.User);
      expect(isAuthorized(auth)).toBe(true);
    });

    it('returns false for unauthenticated user', () => {
      const auth = createMockAuth({ isAuthenticated: false });
      expect(isAuthorized(auth)).toBe(false);
    });

    it('returns false for authenticated user without role', () => {
      const auth = createMockAuth({
        isAuthenticated: true,
        user: {
          access_token: 'test-token',
          profile: {
            sub: '1',
            // No role
          },
        } as AuthContextProps['user'],
      });
      expect(isAuthorized(auth)).toBe(false);
    });
  });

  describe('hasAccessToken', () => {
    it('returns true when user has access token', () => {
      const auth = createAuthenticatedMock(Role.User);
      expect(hasAccessToken(auth)).toBe(true);
    });

    it('returns false when user is null', () => {
      const auth = createMockAuth({ user: null });
      expect(hasAccessToken(auth)).toBe(false);
    });

    it('returns false when access token is undefined', () => {
      const auth = createMockAuth({
        isAuthenticated: true,
        user: {
          profile: { sub: '1' },
          // No access_token
        } as AuthContextProps['user'],
      });
      expect(hasAccessToken(auth)).toBe(false);
    });

    it('returns false when access token is empty string', () => {
      const auth = createMockAuth({
        isAuthenticated: true,
        user: {
          access_token: '',
          profile: { sub: '1' },
        } as AuthContextProps['user'],
      });
      expect(hasAccessToken(auth)).toBe(false);
    });
  });
});
