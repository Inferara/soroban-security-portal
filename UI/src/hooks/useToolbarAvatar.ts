import { useState, useEffect, useCallback } from 'react';
import { useAuth } from 'react-oidc-context';
import { getUserByIdCall } from '../api/soroban-security-portal/soroban-security-portal-api';
import { environment } from '../environments/environment';

interface ToolbarAvatarState {
  avatarUrl: string | null;
  avatarLoading: boolean;
  avatarError: boolean;
  handleAvatarLoad: () => void;
  handleAvatarError: () => void;
}

/**
 * Hook to manage toolbar avatar state for authenticated users.
 * Fetches the current user's data from API to get loginId for avatar URL.
 *
 * Note: We don't rely on OIDC token claims for user ID because the library
 * may not expose them correctly. Instead, we fetch from API.
 *
 * Loading states:
 * - isInitializing: true while fetching user data from API
 * - isImageLoading: true while the avatar image is loading
 * - avatarLoading: combined state (true if either is loading)
 */
export const useToolbarAvatar = (): ToolbarAvatarState => {
  const auth = useAuth();
  const [isInitializing, setIsInitializing] = useState(true);
  const [isImageLoading, setIsImageLoading] = useState(false);
  const [avatarError, setAvatarError] = useState(false);
  const [avatarKey, setAvatarKey] = useState(Date.now());
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);

  // Construct avatar URL only when we have a valid user ID
  const avatarUrl = auth.isAuthenticated && currentUserId
    ? `${environment.apiUrl}/api/v1/user/${currentUserId}/avatar.png?t=${avatarKey}`
    : null;

  // Combined loading state: show spinner while initializing OR while image is loading
  const avatarLoading = (auth.isAuthenticated && isInitializing) || isImageLoading;

  // Fetch current user data when authenticated to get loginId for avatar URL
  useEffect(() => {
    const fetchCurrentUser = async () => {
      if (auth.isAuthenticated && auth.user) {
        setIsInitializing(true);
        try {
          // Call API with loginId=0 to get current user's data
          const userData = await getUserByIdCall(0);
          if (userData?.loginId) {
            setCurrentUserId(userData.loginId);
            setIsImageLoading(true);
            setAvatarError(false);
            setAvatarKey(Date.now());
          }
        } catch (error) {
          console.error('Failed to fetch current user:', error);
          setCurrentUserId(null);
        } finally {
          setIsInitializing(false);
        }
      } else {
        setCurrentUserId(null);
        setIsInitializing(false);
      }
    };
    fetchCurrentUser();
  }, [auth.isAuthenticated, auth.user?.profile?.sub]);

  const handleAvatarLoad = useCallback(() => {
    setIsImageLoading(false);
  }, []);

  const handleAvatarError = useCallback(() => {
    setIsImageLoading(false);
    setAvatarError(true);
  }, []);

  return {
    avatarUrl,
    avatarLoading,
    avatarError,
    handleAvatarLoad,
    handleAvatarError,
  };
};
