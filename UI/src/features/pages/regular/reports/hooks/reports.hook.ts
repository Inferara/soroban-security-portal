import { useEffect, useState } from 'react';
import { getAuditorListDataCall, getCompanyListDataCall, getProtocolListDataCall, getReportsCall } from '../../../../../api/soroban-security-portal/soroban-security-portal-api';
import { ReportSearch, Report } from '../../../../../api/soroban-security-portal/models/report';
import { ProtocolItem } from '../../../../../api/soroban-security-portal/models/protocol';
import { AuditorItem } from '../../../../../api/soroban-security-portal/models/auditor';
import { CompanyItem } from '../../../../../api/soroban-security-portal/models/company';

export const useReports = () => {
  const [reportsList, setReportsList] = useState<Report[]>([]);
  const [protocolsList, setProtocolsList] = useState<ProtocolItem[]>([]);
  const [companiesList, setCompaniesList] = useState<CompanyItem[]>([]);
  const [auditorsList, setAuditorsList] = useState<AuditorItem[]>([]);
  

  const searchReports = async (params?: ReportSearch) => {
    const response = await getReportsCall(params);
    setReportsList(response);  
  };

  const getProtocols = async (): Promise<void> => {
    const response = await getProtocolListDataCall();
    setProtocolsList(response);
  };

  const getCompanies = async (): Promise<void> => {
    const response = await getCompanyListDataCall();
    setCompaniesList(response);
  };

  const getAuditors = async (): Promise<void> => {
    const response = await getAuditorListDataCall();
    setAuditorsList(response);
  };

  useEffect(() => {
    void searchReports();
    void getProtocols();
    void getCompanies();
    void getAuditors();
  }, []);

  return {
    reportsList,
    searchReports,
    protocolsList,
    companiesList,
    auditorsList,
  };
} 