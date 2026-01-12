import { useMemo, useCallback } from 'react';
import { getUserListDataCall, userEnabledCall, removeUserCall, userDisableCall } from '../../../../../../api/soroban-security-portal/soroban-security-portal-api';
import { CurrentPageState } from '../../../admin-main-window/current-page-slice';
import { UserItem } from '../../../../../../api/soroban-security-portal/models/user';
import { useAdminList } from '../../../../../../hooks/admin';

type UseListUsersProps = {
    currentPageState: CurrentPageState;
};

// Helper function that handles enable/disable based on boolean
const userToggleEnabled = async (loginId: number, isEnabled: boolean): Promise<void> => {
    if (isEnabled) {
        await userEnabledCall(loginId);
    } else {
        await userDisableCall(loginId);
    }
};

export const useListUsers = (props: UseListUsersProps) => {
    const { currentPageState } = props;

    const customOperations = useMemo(() => ({
        toggleEnabled: {
            handler: userToggleEnabled,
            refreshAfter: false, // UI updates via switch state, no need to refresh
        },
    }), []);

    const { data, remove, operations } = useAdminList({
        fetchData: getUserListDataCall,
        removeItem: removeUserCall,
        currentPageState,
        customOperations,
    });

    // Wrapper to maintain existing API signature
    const userEnabledChange = useCallback(async (loginId: number, isEnabled: boolean): Promise<void> => {
        await (operations.toggleEnabled as (id: number, enabled: boolean) => Promise<void>)(loginId, isEnabled);
    }, [operations]);

    return {
        userListData: data as UserItem[],
        userEnabledChange,
        userRemove: remove,
    };
};
