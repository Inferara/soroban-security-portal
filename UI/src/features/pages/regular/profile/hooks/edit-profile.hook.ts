import { useState, useEffect } from 'react';
import { useAuth } from 'react-oidc-context';
import { selfEditUserCall, getUserByIdCall } from '../../../../../api/soroban-security-portal/soroban-security-portal-api';
import { UserItem, SelfEditUserItem  } from '../../../../../api/soroban-security-portal/models/user';

export const useEditProfile = () => {
  const auth = useAuth();
  const [user, setUser] = useState<UserItem | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const getUserData = async (): Promise<void> => {
    if (auth.user?.profile.sub) {
      const userResponse = await getUserByIdCall(0);
      if (userResponse) {
        setUser(userResponse);
      }
    }
  };

  const updateProfile = async (profileData: {
    fullName: string;
    login: string;
    personalInfo: string;
    image?: string;
    isAvatarManuallySet?: boolean;
  }): Promise<boolean> => {
    if (!user) return false;

    setIsLoading(true);
    try {
      const selfEditUserItem: SelfEditUserItem  = {
        fullName: profileData.fullName,
        image: profileData.image || '',
        personalInfo: profileData.personalInfo,
        connectedAccounts: user.connectedAccounts,
        isAvatarManuallySet: profileData.isAvatarManuallySet,
      };

      const response = await selfEditUserCall(user.loginId, selfEditUserItem);
      
      if (response) {
        // Refresh user data after successful update
        await getUserData();
      }
      
      return response;
    } catch (error) {
      console.error('Error updating profile:', error);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void getUserData();
  }, [auth.user]);

  return {
    user,
    updateProfile,
    isLoading,
  };
}; 