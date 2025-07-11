import { useEffect, useState } from 'react';
import { editUserCall, getUserByIdCall } from '../../../../../../api/soroban-security-portal/soroban-security-portal-api';
import { useAppDispatch } from '../../../../../../app/hooks';
import { CurrentPageState, setCurrentPage } from '../../../admin-main-window/current-page-slice';
import { useSearchParams } from 'react-router-dom';
import { UserItem } from '../../../../../../api/soroban-security-portal/models/user';
import { EditUserItem } from '../../../../../../api/soroban-security-portal/models/user';

type UseEditUserProps = {
    currentPageState: CurrentPageState;
};

export const useEditUser = (props: UseEditUserProps) => {
    const { currentPageState } = props;
    const dispatch = useAppDispatch();
    const [searchParams] = useSearchParams();
    const [user, setUser] = useState<UserItem | null | undefined>(undefined);
    const loginId = parseInt(searchParams.get('loginId') ?? '');

    const editUser = async (loginId: number, editUserItem: EditUserItem): Promise<boolean> => {
        const response = await editUserCall(loginId, editUserItem);
        return response;
    };

    const getUserById = async (): Promise<void> => {
        if (loginId) {
          const response = await getUserByIdCall(loginId);
          setUser(response);
        } else {
          setUser(null);
        }
      };

    // Set the current page
    useEffect(() => {
        dispatch(setCurrentPage(currentPageState));
        void getUserById();
    }, [dispatch]);

    return {
        editUser, user, loginId
    };
};
