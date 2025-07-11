import { useEffect } from 'react';
import { changePasswordCall } from '../../../../../api/soroban-security-portal/soroban-security-portal-api'; 
import { useAppDispatch } from '../../../../../app/hooks';
import { CurrentPageState, setCurrentPage } from '../../admin-main-window/current-page-slice';

type UseMyProfileProps = {
    currentPageState: CurrentPageState;
};

export const useMyProfile = (props: UseMyProfileProps) => {
    const { currentPageState } = props;
    const dispatch = useAppDispatch();

    const changePassword = async (oldPassword: string, newPassword: string): Promise<boolean> => {
        const changePasswordResponse = await changePasswordCall(oldPassword, newPassword);
        return changePasswordResponse;
    };

      // Set the current page
    useEffect(() => {
        dispatch(setCurrentPage(currentPageState));
    }, [dispatch]);

    return {
        changePassword,
    };
};
