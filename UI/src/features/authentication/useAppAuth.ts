import { useAuth, AuthContextProps } from 'react-oidc-context';
import { environment } from '../../environments/environment';
import { Role } from '../../api/soroban-security-portal/models/role';
import { 
  isAdmin, 
  isModerator, 
  isContributor, 
  canEdit, 
  isAuthorized
} from './authPermissions';

/**
 * Authentication hook providing centralized access to auth state
 * and convenient permission checking utilities
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
  canEdit: boolean;
  isAuthorized: boolean;
  
  // User info
  userRole: Role | undefined;
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
    canEdit: canEdit(auth),
    isAuthorized: isAuthorized(auth),
    
    // User info
    userRole: auth.user?.profile.role as Role | undefined,
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
