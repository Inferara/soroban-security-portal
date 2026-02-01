import { useMemo, useCallback, useState } from 'react';
import {
    getAllReportListDataCall,
    removeReportCall,
    approveReportCall,
    rejectReportCall,
    extractVulnerabilitiesFromReportCall,
    VulnerabilityExtractionResult,
    downloadReportPDFCall,
} from '../../../../../../api/soroban-security-portal/soroban-security-portal-api';
import { CurrentPageState } from '../../../admin-main-window/current-page-slice';
import { Report } from '../../../../../../api/soroban-security-portal/models/report';
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

    const downloadReport = useCallback(async (reportId: number): Promise<void> => {
        try {
            const blob = await downloadReportPDFCall(reportId);

            // Create blob URL and open in new tab
            const blobUrl = window.URL.createObjectURL(blob);
            window.open(blobUrl, '_blank');

            // Clean up blob URL after a delay to ensure it loads
            setTimeout(() => window.URL.revokeObjectURL(blobUrl), 10000);
        } catch (error) {
            const errorMessage =
                error instanceof Error && error.message
                    ? error.message
                    : 'An unexpected error occurred while downloading the report.';
            console.error('Failed to download report:', error);
            window.alert(`Failed to download report. ${errorMessage}`);
        }
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
