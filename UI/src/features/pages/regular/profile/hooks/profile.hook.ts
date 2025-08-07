import { useSearchParams } from 'react-router-dom';
import { changePasswordCall, getUserByIdCall } from '../../../../../api/soroban-security-portal/soroban-security-portal-api'; 
import { UserItem } from '../../../../../api/soroban-security-portal/models/user';
import { useEffect, useState } from 'react';

export const useProfile = () => {
    const [searchParams] = useSearchParams();
    const userId = parseInt(searchParams.get('userId') ?? '0');
    const [user, setUser] = useState<UserItem | null>(null);

    const changePassword = async (oldPassword: string, newPassword: string): Promise<boolean> => {
        const changePasswordResponse = await changePasswordCall(oldPassword, newPassword);
        return changePasswordResponse;
    };

    const getUserById = async (): Promise<void> => {
        const userResponse = await getUserByIdCall(userId);
        if (userResponse) {
            setUser(userResponse);
        }
    };

    useEffect(() => {
        void getUserById();
    }, [userId]);

    return {
        changePassword,
        user,
        userId
    };
}; 