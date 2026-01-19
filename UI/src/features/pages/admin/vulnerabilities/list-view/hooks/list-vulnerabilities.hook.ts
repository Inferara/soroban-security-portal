import { useMemo } from 'react';
import {
    getVulnerabilityListDataCall,
    removeVulnerabilityCall,
    approveVulnerabilityCall,
    rejectVulnerabilityCall,
} from '../../../../../../api/soroban-security-portal/soroban-security-portal-api';
import { CurrentPageState } from '../../../admin-main-window/current-page-slice';
import { Vulnerability } from '../../../../../../api/soroban-security-portal/models/vulnerability';
import { useAdminList } from '../../../../../../hooks/admin';

type UseListVulnerabilitiesProps = {
    currentPageState: CurrentPageState;
};

export const useListVulnerabilities = (props: UseListVulnerabilitiesProps) => {
    const { currentPageState } = props;

    const customOperations = useMemo(() => ({
        approve: { handler: approveVulnerabilityCall },
        reject: { handler: rejectVulnerabilityCall },
    }), []);

    const { data, remove, operations } = useAdminList({
        fetchData: getVulnerabilityListDataCall,
        removeItem: removeVulnerabilityCall,
        currentPageState,
        customOperations,
    });

    return {
        vulnerabilityListData: data as Vulnerability[],
        vulnerabilityRemove: remove,
        vulnerabilityApprove: operations.approve as (id: number) => Promise<void>,
        vulnerabilityReject: operations.reject as (id: number) => Promise<void>,
    };
};
