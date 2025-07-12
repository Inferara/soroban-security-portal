import { useEffect, useState } from 'react';
import { editAuditorCall, getAuditorByIdCall } from '../../../../../../api/soroban-security-portal/soroban-security-portal-api';
import { useAppDispatch } from '../../../../../../app/hooks';
import { CurrentPageState, setCurrentPage } from '../../../admin-main-window/current-page-slice';
import { useSearchParams } from 'react-router-dom';
import { AuditorItem } from '../../../../../../api/soroban-security-portal/models/auditor';

type UseEditAuditorProps = {
    currentPageState: CurrentPageState;
};

export const useEditAuditor = (props: UseEditAuditorProps) => {
    const { currentPageState } = props;
    const dispatch = useAppDispatch();
    const [searchParams] = useSearchParams();
    const [auditor, setAuditor] = useState<AuditorItem | null | undefined>(undefined);
    const auditorId = parseInt(searchParams.get('auditorId') ?? '');

    const editAuditor = async (auditorItem: AuditorItem): Promise<boolean> => {
        const response = await editAuditorCall(auditorItem);
        return response;
    };

    const getAuditorById = async (): Promise<void> => {
        if (auditorId) {
          const response = await getAuditorByIdCall(auditorId);
          setAuditor(response);
        } else {
          setAuditor(null);
        }
      };

    // Set the current page
    useEffect(() => {
        dispatch(setCurrentPage(currentPageState));
        void getAuditorById();
    }, [dispatch]);

    return {
        editAuditor, auditor, auditorId
    };
};
