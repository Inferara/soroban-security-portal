import { useEffect, useRef, useState } from 'react';
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
  // Searches can overlap (sort toggle, Search button, initial load). Only the latest
  // request may update the list, so a slow earlier response cannot overwrite a newer one.
  const searchRequestIdRef = useRef(0);

  const searchReports = async (params?: ReportSearch) => {
    const requestId = ++searchRequestIdRef.current;
    const response = await getReportsCall(params);
    if (searchRequestIdRef.current !== requestId) {
      return;
    }
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
    // Open sorted by the report's own date, newest first (matches the page's default sort toggle).
    void searchReports({ sortBy: 'date', sortDirection: 'desc' });
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
