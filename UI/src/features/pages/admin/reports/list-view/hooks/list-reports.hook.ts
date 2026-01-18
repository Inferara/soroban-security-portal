import { useMemo, useCallback } from 'react';
import {
    getAllReportListDataCall,
    removeReportCall,
    approveReportCall,
    rejectReportCall,
} from '../../../../../../api/soroban-security-portal/soroban-security-portal-api';
import { CurrentPageState } from '../../../admin-main-window/current-page-slice';
import { Report } from '../../../../../../api/soroban-security-portal/models/report';
import { environment } from '../../../../../../environments/environment';
import { useAdminList } from '../../../../../../hooks/admin';

type UseListReportsProps = {
    currentPageState: CurrentPageState;
};

export const useListReports = (props: UseListReportsProps) => {
    const { currentPageState } = props;

    const customOperations = useMemo(() => ({
        approve: { handler: approveReportCall },
        reject: { handler: rejectReportCall },
    }), []);

    const { data, remove, operations } = useAdminList({
        fetchData: getAllReportListDataCall,
        removeItem: removeReportCall,
        currentPageState,
        customOperations,
    });

    // downloadReport is a client-side action (no API call, just opens URL)
    const downloadReport = useCallback(async (reportId: number): Promise<void> => {
        const url = `${environment.apiUrl}/api/v1/reports/${reportId}/download`;
        window.open(url, '_blank');
    }, []);

    return {
        reportListData: data as Report[],
        reportRemove: remove,
        reportApprove: operations.approve as (id: number) => Promise<void>,
        reportReject: operations.reject as (id: number) => Promise<void>,
        downloadReport,
    };
};
