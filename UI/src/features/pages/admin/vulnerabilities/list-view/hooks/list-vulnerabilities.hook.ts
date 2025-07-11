import { useEffect, useState } from 'react';
import { 
    getVulnerabilityListDataCall, 
    removeVulnerabilityCall, 
    approveVulnerabilityCall,
    rejectVulnerabilityCall,
} from '../../../../../../api/soroban-security-portal/soroban-security-portal-api'; 
import { useAppDispatch } from '../../../../../../app/hooks';
import { CurrentPageState, setCurrentPage } from '../../../admin-main-window/current-page-slice';
import { Vulnerability } from '../../../../../../api/soroban-security-portal/models/vulnerability';

type UseListVulnerabilitiesProps = {
    currentPageState: CurrentPageState;
};

export const useListVulnerabilities = (props: UseListVulnerabilitiesProps) => {
    const { currentPageState } = props;
    const [vulnerabilityListData, setVulnerabilityListData] = useState<Vulnerability[]>([]);
    const dispatch = useAppDispatch();

    const getVulnerabilityListData = async (): Promise<void> => {
        const vulnerabilityListDataResponse = await getVulnerabilityListDataCall();
        setVulnerabilityListData(vulnerabilityListDataResponse);
    };

    const vulnerabilityRemove = async (loginId: number): Promise<void> => {        
        await removeVulnerabilityCall(loginId);
        await getVulnerabilityListData();
    }

    const vulnerabilityApprove = async (loginId: number): Promise<void> => {
        await approveVulnerabilityCall(loginId);
        await getVulnerabilityListData();
    }

    const vulnerabilityReject = async (loginId: number): Promise<void> => {
        await rejectVulnerabilityCall(loginId);
        await getVulnerabilityListData();
    }

    // Set the current page
    useEffect(() => {
        dispatch(setCurrentPage(currentPageState));
        void getVulnerabilityListData();
    }, [dispatch]);

    return {
        vulnerabilityListData,
        vulnerabilityRemove,
        vulnerabilityApprove,
        vulnerabilityReject,
    };
};
