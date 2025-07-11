import { useEffect, useState } from 'react';
import { 
    getSubscriptionsListCall, 
} from '../../../../../api/soroban-security-portal/soroban-security-portal-api'; 
import { useAppDispatch } from '../../../../../app/hooks';
import { CurrentPageState, setCurrentPage } from '../../admin-main-window/current-page-slice';
import { Subscription } from '../../../../../api/soroban-security-portal/models/subscription';

type UseSubscriptionsProps = {
    currentPageState: CurrentPageState;
};

export const useSubscriptions = (props: UseSubscriptionsProps) => {
    const { currentPageState } = props;
    const dispatch = useAppDispatch();
    const [subscriptionsListData, setSubscriptionsListData] = useState<Subscription[]>([]);

    const getSubscriptionsListData = async (): Promise<void> => {
        const subscriptionsListDataResponse = await getSubscriptionsListCall();
        setSubscriptionsListData(subscriptionsListDataResponse);
    };

    // Set the current page
    useEffect(() => {
        dispatch(setCurrentPage(currentPageState));
        void getSubscriptionsListData();
    }, [dispatch]);

    return {
        subscriptionsListData,
    };
}; 