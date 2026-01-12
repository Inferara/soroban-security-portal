import { useAuth, AuthContextProps } from 'react-oidc-context';
import { environment } from '../../environments/environment';
import { Role } from '../../api/soroban-security-portal/models/role';
import {
  isAdmin,
  isModerator,
  isContributor,
  isAdminOrModerator,
  canEdit,
  canAddReport,
  isAuthorized,
  getUserRole,
} from './authPermissions';

/**
 * Authentication hook providing centralized access to auth state
 * and convenient permission checking utilities.
 *
 * @example
 * ```tsx
 * const { isAdmin, canEdit, canAddReport, userRole } = useAppAuth();
 *
 * // Use in conditional rendering
 * {canAddReport && <Button>Add Report</Button>}
 * {isAdminOrModerator && <Button>Approve</Button>}
 * ```
 */
export interface UseAppAuthReturn {
  // Core auth state
  auth: AuthContextProps;
  isAuthenticated: boolean;
  isLoading: boolean;
  user: AuthContextProps['user'];
  accessToken: string | undefined;

  // Role checks
  isAdmin: boolean;
  isModerator: boolean;
  isContributor: boolean;
  isAdminOrModerator: boolean;
  canEdit: boolean;
  canAddReport: boolean;
  isAuthorized: boolean;

  // User info
  userRole: Role | null;
  userName: string | undefined;
  userEmail: string | undefined;

  // Auth actions
  login: () => void;
  logout: () => void;
}

export const useAppAuth = (): UseAppAuthReturn => {
  const auth = useAuth();

  return {
    // Core auth state
    auth,
    isAuthenticated: auth.isAuthenticated,
    isLoading: auth.isLoading,
    user: auth.user,
    accessToken: auth.user?.access_token,

    // Role checks
    isAdmin: isAdmin(auth),
    isModerator: isModerator(auth),
    isContributor: isContributor(auth),
    isAdminOrModerator: isAdminOrModerator(auth),
    canEdit: canEdit(auth),
    canAddReport: canAddReport(auth),
    isAuthorized: isAuthorized(auth),

    // User info (with safe role extraction)
    userRole: getUserRole(auth),
    userName: auth.user?.profile.name,
    userEmail: auth.user?.profile.email,

    // Auth actions
    login: () => auth.signinRedirect(),
    logout: () => {
      // Clear OIDC storage
      const oidcStorageKey = `oidc.user:${environment.apiUrl}/api/v1/connect:${environment.clientId}`;
      localStorage.removeItem(oidcStorageKey);

      // Trigger auth library logout
      auth.removeUser();
    },
  };
};
