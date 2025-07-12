import { useEffect, useState } from 'react';
import { getAuditorListDataCall, getProjectListDataCall, getReportsCall } from '../../../../../api/soroban-security-portal/soroban-security-portal-api';
import { ReportSearch, Report } from '../../../../../api/soroban-security-portal/models/report';
import { ProjectItem } from '../../../../../api/soroban-security-portal/models/project';
import { AuditorItem } from '../../../../../api/soroban-security-portal/models/auditor';

export const useReports = () => {
  const [reportsList, setReportsList] = useState<Report[]>([]);
  const [projectsList, setProjectsList] = useState<ProjectItem[]>([]);
  const [auditorsList, setAuditorsList] = useState<AuditorItem[]>([]);
  

  const searchReports = async (params?: ReportSearch) => {
    const response = await getReportsCall(params);
    setReportsList(response);  
  };

  const getProjects = async (): Promise<void> => {
    const response = await getProjectListDataCall();
    setProjectsList(response);
  };

  const getAuditors = async (): Promise<void> => {
    const response = await getAuditorListDataCall();
    setAuditorsList(response);
  };

  useEffect(() => {
    void searchReports();
    void getProjects();
    void getAuditors();
  }, []);

  return {
    reportsList,
    searchReports,
    projectsList,
    auditorsList,
  };
} 