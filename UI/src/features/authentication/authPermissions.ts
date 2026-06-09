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

export const hasAnyRole = (auth: AuthContextProps, ...roles: Role[]): boolean => {
  const userRole = getUserRole(auth);
  return userRole !== null && roles.includes(userRole);
};

export const isAdmin = (auth: AuthContextProps): boolean => {
  return hasAnyRole(auth, Role.Admin);
};

export const isModerator = (auth: AuthContextProps): boolean => {
  return hasAnyRole(auth, Role.Moderator);
};

export const isContributor = (auth: AuthContextProps): boolean => {
  return hasAnyRole(auth, Role.Contributor);
};

// ============================================================================
// Composite Permission Checks
// ============================================================================

/**
 * Check if user has admin-level access (Admin or Moderator).
 * Used for approval/rejection actions, editing others' content, etc.
 */
export const isAdminOrModerator = (auth: AuthContextProps): boolean => {
  return hasAnyRole(auth, Role.Admin, Role.Moderator);
};

/**
 * Check if user can edit content (Admin, Moderator, or Contributor).
 * Used for creating and editing own content.
 */
export const canEdit = (auth: AuthContextProps): boolean => {
  return hasAnyRole(auth, Role.Admin, Role.Moderator, Role.Contributor);
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
  return getUserRole(auth) !== null;
};

/**
 * Check if user has access token available.
 */
export const hasAccessToken = (auth: AuthContextProps): boolean => {
  return !!auth.user?.access_token;
};

// ============================================================================
// Auth Lifecycle Checks
// ============================================================================

/**
 * Whether the app is in its *initial* authentication phase and should block the
 * UI with a full-screen loading state.
 *
 * react-oidc-context flips `isLoading` to true for the duration of ANY wrapped
 * navigator call, including `signinSilent()`. A background silent token renewal
 * (e.g. when the user clicks "Stay Logged In") must NOT blank out an already
 * authenticated screen: doing so unmounts the current page and throws away any
 * unsaved in-progress edits. We only show the blocking loader when there is no
 * authenticated user yet (the genuine cold-start / sign-in case).
 */
export const isInitialAuthLoading = (auth: AuthContextProps): boolean => {
  return auth.isLoading && !auth.isAuthenticated;
};
