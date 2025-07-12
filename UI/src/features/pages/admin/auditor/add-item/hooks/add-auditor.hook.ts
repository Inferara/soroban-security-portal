import { useEffect } from 'react';
import { addAuditorCall } from '../../../../../../api/soroban-security-portal/soroban-security-portal-api';
import { useAppDispatch } from '../../../../../../app/hooks';
import { CurrentPageState, setCurrentPage } from '../../../admin-main-window/current-page-slice';
import { AuditorItem } from '../../../../../../api/soroban-security-portal/models/auditor';

type UseAddAuditorProps = {
    currentPageState: CurrentPageState;
};

export const useAddAuditor = (props: UseAddAuditorProps) => {
    const { currentPageState } = props;
    const dispatch = useAppDispatch();

    const addAuditor = async (auditorItem: AuditorItem): Promise<boolean> => {
        const response = await addAuditorCall(auditorItem);
        return response;
    };

    // Set the current page
    useEffect(() => {
        dispatch(setCurrentPage(currentPageState));
    }, [dispatch]);

    return {
        addAuditor
    };
};
