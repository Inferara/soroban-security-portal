import { useState, useEffect } from 'react';
import { useAuth } from 'react-oidc-context';
import { editUserCall, getUserByIdCall } from '../../../../../api/soroban-security-portal/soroban-security-portal-api';
import { UserItem, EditUserItem } from '../../../../../api/soroban-security-portal/models/user';

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
  }): Promise<boolean> => {
    if (!user) return false;

    setIsLoading(true);
    try {
      const editUserItem: EditUserItem = {
        isEnabled: true,
        fullName: profileData.fullName,
        email: user.email,
        role: user.role,
        image: profileData.image || '',
        personalInfo: profileData.personalInfo,
        connectedAccounts: user.connectedAccounts,
      };

      const response = await editUserCall(user.loginId, editUserItem);
      
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