import { useEffect, useState } from 'react';
import { getAuditorListDataCall, removeAuditorCall } from '../../../../../../api/soroban-security-portal/soroban-security-portal-api'; 
import { useAppDispatch } from '../../../../../../app/hooks';
import { CurrentPageState, setCurrentPage } from '../../../admin-main-window/current-page-slice';
import { AuditorItem } from '../../../../../../api/soroban-security-portal/models/auditor';

type UseListAuditorsProps = {
    currentPageState: CurrentPageState;
};

export const useListAuditors = (props: UseListAuditorsProps) => {
    const { currentPageState } = props;
    const [auditorListData, setAuditorListData] = useState<AuditorItem[]>([]);
    const dispatch = useAppDispatch();

    const getAuditorListData = async (): Promise<void> => {
        const auditorListDataResponse = await getAuditorListDataCall();
        setAuditorListData(auditorListDataResponse);
    };

    const auditorRemove = async (id: number): Promise<void> => {        
        await removeAuditorCall(id);
        await getAuditorListData();
    }

    // Set the current page
    useEffect(() => {
        dispatch(setCurrentPage(currentPageState));
        void getAuditorListData();
    }, [dispatch]);

    return {
        auditorListData,
        auditorRemove
    };
};
