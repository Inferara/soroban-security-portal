import { useMemo, useCallback, useState } from 'react';
import {
    getAllReportListDataCall,
    removeReportCall,
    approveReportCall,
    rejectReportCall,
    extractVulnerabilitiesFromReportCall,
    VulnerabilityExtractionResult,
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

    // Extraction state
    const [extractingReportId, setExtractingReportId] = useState<number | null>(null);
    const [extractionResult, setExtractionResult] = useState<VulnerabilityExtractionResult | null>(null);
    const [extractionError, setExtractionError] = useState<string | null>(null);

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

    // Extract vulnerabilities from a report using AI
    const extractVulnerabilities = useCallback(async (reportId: number): Promise<void> => {
        setExtractingReportId(reportId);
        setExtractionError(null);
        try {
            const result = await extractVulnerabilitiesFromReportCall(reportId);
            setExtractionResult(result);
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Extraction failed';
            setExtractionError(message);
        } finally {
            setExtractingReportId(null);
        }
    }, []);

    // Clear extraction result
    const clearExtractionResult = useCallback(() => {
        setExtractionResult(null);
        setExtractionError(null);
    }, []);

    return {
        reportListData: data as Report[],
        reportRemove: remove,
        reportApprove: operations.approve as (id: number) => Promise<void>,
        reportReject: operations.reject as (id: number) => Promise<void>,
        downloadReport,
        // Extraction
        extractVulnerabilities,
        extractingReportId,
        extractionResult,
        extractionError,
        clearExtractionResult,
    };
};
