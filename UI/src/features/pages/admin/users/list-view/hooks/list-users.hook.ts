import { useEffect, useState } from 'react';
import { getUserListDataCall, userEnabledCall, removeUserCall, userDisableCall } from '../../../../../../api/soroban-security-portal/soroban-security-portal-api'; 
import { useAppDispatch } from '../../../../../../app/hooks';
import { CurrentPageState, setCurrentPage } from '../../../admin-main-window/current-page-slice';
import { UserItem } from '../../../../../../api/soroban-security-portal/models/user';

type UseListUsersProps = {
    currentPageState: CurrentPageState;
};

export const useListUsers = (props: UseListUsersProps) => {
    const { currentPageState } = props;
    const [userListData, setUserListData] = useState<UserItem[]>([]);
    const dispatch = useAppDispatch();

    const getUserListData = async (): Promise<void> => {
        const userListDataResponse = await getUserListDataCall();
        setUserListData(userListDataResponse);
    };

    const userEnabledChange = async (loginId: number, isEnabled: boolean): Promise<void> => {        
        if (isEnabled){
            await userEnabledCall(loginId);
        } 
        else {
            await userDisableCall(loginId);
        }
    }

    const userRemove = async (loginId: number): Promise<void> => {        
        await removeUserCall(loginId);
        await getUserListData();
    }

    // Set the current page
    useEffect(() => {
        dispatch(setCurrentPage(currentPageState));
        void getUserListData();
    }, [dispatch]);

    return {
        userListData,
        userEnabledChange,
        userRemove
    };
};
