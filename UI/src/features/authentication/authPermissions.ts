import { AuthContextProps } from 'react-oidc-context';
import { Role } from '../../api/soroban-security-portal/models/role';

/**
 * Centralized authentication permission helpers
 * Provides consistent role checking across the application
 */

export const isAdmin = (auth: AuthContextProps): boolean => {
  return auth.isAuthenticated && auth.user?.profile.role === Role.Admin;
};

export const isModerator = (auth: AuthContextProps): boolean => {
  return auth.isAuthenticated && auth.user?.profile.role === Role.Moderator;
};

export const isContributor = (auth: AuthContextProps): boolean => {
  return auth.isAuthenticated && auth.user?.profile.role === Role.Contributor;
};

/**
 * Check if user can edit content (Admin, Moderator, or Contributor)
 */
export const canEdit = (auth: AuthContextProps): boolean => {
  return isAdmin(auth) || isModerator(auth) || isContributor(auth);
};

/**
 * Check if user is authorized (any logged-in user with a role)
 */
export const isAuthorized = (auth: AuthContextProps): boolean => {
  return auth.isAuthenticated && !!auth.user?.profile.role;
};

/**
 * Check if user has access token available
 */
export const hasAccessToken = (auth: AuthContextProps): boolean => {
  return !!auth.user?.access_token;
};
