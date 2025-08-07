import { useEffect, useState } from 'react';
import { 
  editReportCall, 
  getReportByIdCall,
  getAuditorListDataCall, 
  getProtocolListDataCall,
  getCompanyListDataCall, 
} from '../../../../../../api/soroban-security-portal/soroban-security-portal-api';
import { useAppDispatch } from '../../../../../../app/hooks';
import { CurrentPageState, setCurrentPage } from '../../../admin-main-window/current-page-slice';
import { useSearchParams } from 'react-router-dom';
import { Report } from '../../../../../../api/soroban-security-portal/models/report';
import { ProtocolItem } from '../../../../../../api/soroban-security-portal/models/protocol';
import { AuditorItem } from '../../../../../../api/soroban-security-portal/models/auditor';
import { CompanyItem } from '../../../../../../api/soroban-security-portal/models/company';

type UseEditReportProps = {
    currentPageState: CurrentPageState;
};

export const useEditReport = (props: UseEditReportProps) => {
    const { currentPageState } = props;
    const dispatch = useAppDispatch();
    const [searchParams] = useSearchParams();
    const reportId = parseInt(searchParams.get('reportId') ?? '');
    const [report, setReport] = useState<Report | null | undefined>(undefined);
    const [companiesList, setCompaniesList] = useState<CompanyItem[]>([]);
    const [protocolsList, setProtocolsList] = useState<ProtocolItem[]>([]);
    const [auditorsList, setAuditorsList] = useState<AuditorItem[]>([]);

    const editReport = async (reportItem: Report): Promise<boolean> => {
        const response = await editReportCall(reportItem);
        return response;
    };

    const getReportById = async (): Promise<void> => {
        if (reportId) {
          const response = await getReportByIdCall(reportId);
          setReport(response);
        } else {
          setReport(null);
        }
      };

    const getCompanies = async (): Promise<void> => {
        const response = await getCompanyListDataCall();
        setCompaniesList(response);
    };

    const getProtocols = async (): Promise<void> => {
        const response = await getProtocolListDataCall();
        setProtocolsList(response);
    };

    const getAuditors = async (): Promise<void> => {
        const response = await getAuditorListDataCall();
        setAuditorsList(response);
    };

    // Set the current page
    useEffect(() => {
        dispatch(setCurrentPage(currentPageState));
        void getReportById();
        void getCompanies();
        void getProtocols();
        void getAuditors();
    }, [dispatch]);

    return {
        editReport, 
        report, 
        reportId,
        companiesList,
        protocolsList,
        auditorsList,
    };
}; 