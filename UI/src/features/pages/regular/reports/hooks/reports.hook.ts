import { useEffect, useState } from 'react';
import { getReportsCall } from '../../../../../api/soroban-security-portal/soroban-security-portal-api';
import { ReportSearch, Report } from '../../../../../api/soroban-security-portal/models/report';

export const useReports = () => {
  const [reportsList, setReportsList] = useState<Report[]>([]);
  
  const searchReports = async (params?: ReportSearch) => {
    const response = await getReportsCall(params);
    setReportsList(response);  
  };

  useEffect(() => {
    void searchReports();
  }, []);

  return {
    reportsList,
    searchReports,
  };
} 