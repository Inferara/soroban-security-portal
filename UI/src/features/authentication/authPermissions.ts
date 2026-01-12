import { AuthContextProps } from 'react-oidc-context';
import { Role } from '../../api/soroban-security-portal/models/role';

/**
 * Centralized authentication permission helpers
 *
 * IMPORTANT: These utilities are for CLIENT-SIDE UI/UX only.
 * All authorization MUST be enforced by the backend API via [RoleAuthorize] attribute.
 * These functions determine what UI elements to show, not actual access rights.
 */

// ============================================================================
// Role Validation Utilities
// ============================================================================

/** Valid roles for runtime validation */
const VALID_ROLES = new Set(Object.values(Role));

/**
 * Type guard to validate role value at runtime.
 * Ensures the role is a known enum value, not an arbitrary string.
 */
export const isValidRole = (value: unknown): value is Role => {
  return typeof value === 'string' && VALID_ROLES.has(value as Role);
};

/**
 * Safely extract and validate user role from auth context.
 * Returns null if auth is invalid or role is unrecognized.
 */
export const getUserRole = (auth: AuthContextProps): Role | null => {
  if (!auth.isAuthenticated || !auth.user) {
    return null;
  }
  const role = auth.user.profile?.role;
  return isValidRole(role) ? role : null;
};

// ============================================================================
// Basic Role Checks
// ============================================================================

export const isAdmin = (auth: AuthContextProps): boolean => {
  return auth.isAuthenticated && auth.user?.profile.role === Role.Admin;
};

export const isModerator = (auth: AuthContextProps): boolean => {
  return auth.isAuthenticated && auth.user?.profile.role === Role.Moderator;
};

export const isContributor = (auth: AuthContextProps): boolean => {
  return auth.isAuthenticated && auth.user?.profile.role === Role.Contributor;
};

// ============================================================================
// Composite Permission Checks
// ============================================================================

/**
 * Check if user has admin-level access (Admin or Moderator).
 * Used for approval/rejection actions, editing others' content, etc.
 */
export const isAdminOrModerator = (auth: AuthContextProps): boolean => {
  return isAdmin(auth) || isModerator(auth);
};

/**
 * Check if user can edit content (Admin, Moderator, or Contributor).
 * Used for creating and editing own content.
 */
export const canEdit = (auth: AuthContextProps): boolean => {
  return isAdmin(auth) || isModerator(auth) || isContributor(auth);
};

/**
 * Check if user can add reports (Admin, Moderator, or Contributor).
 * Alias for canEdit - explicitly named for clarity in report-related contexts.
 */
export const canAddReport = (auth: AuthContextProps): boolean => {
  return canEdit(auth);
};

/**
 * Check if user is authorized (any logged-in user with a valid role).
 */
export const isAuthorized = (auth: AuthContextProps): boolean => {
  return auth.isAuthenticated && !!auth.user?.profile.role;
};

/**
 * Check if user has access token available.
 */
export const hasAccessToken = (auth: AuthContextProps): boolean => {
  return !!auth.user?.access_token;
};
