import { useEffect, useState } from 'react';
import { 
    getReportListDataCall, 
    removeReportCall, 
    approveReportCall,
    rejectReportCall,
} from '../../../../../../api/soroban-security-portal/soroban-security-portal-api'; 
import { useAppDispatch } from '../../../../../../app/hooks';
import { CurrentPageState, setCurrentPage } from '../../../admin-main-window/current-page-slice';
import { Report } from '../../../../../../api/soroban-security-portal/models/report';
import { environment } from '../../../../../../environments/environment';

type UseListReportsProps = {
    currentPageState: CurrentPageState;
};

export const useListReports = (props: UseListReportsProps) => {
    const { currentPageState } = props;
    const [reportListData, setReportListData] = useState<Report[]>([]);
    const dispatch = useAppDispatch();

    const getReportListData = async (): Promise<void> => {
        const reportListDataResponse = await getReportListDataCall();
        setReportListData(reportListDataResponse);
    };

    const reportRemove = async (reportId: number): Promise<void> => {        
        await removeReportCall(reportId);
        await getReportListData();
    }

    const reportApprove = async (reportId: number): Promise<void> => {
        await approveReportCall(reportId);
        await getReportListData();
    }

    const reportReject = async (reportId: number): Promise<void> => {
        await rejectReportCall(reportId);
        await getReportListData();
    }

    const downloadReport = async (reportId: number): Promise<void> => {
        const url = `${environment.apiUrl}/api/v1/reports/${reportId}/download`;
        window.open(url, '_blank');
    }

    // Set the current page
    useEffect(() => {
        dispatch(setCurrentPage(currentPageState));
        void getReportListData();
    }, [dispatch]);

    return {
        reportListData,
        reportRemove,
        reportApprove,
        reportReject,
        downloadReport,
    };
}; 