import { useEffect, useState } from 'react';
import { 
  getSeveritiesCall, 
  getCategoriesCall, 
  getProjectListDataCall, 
  getAuditorListDataCall,
  getSourceCall, 
  getVulnerabilitiesCall,
  getReportListDataCall
} from '../../../../../api/soroban-security-portal/soroban-security-portal-api';
import { useAppDispatch } from '../../../../../app/hooks';
import { 
  Vulnerability,
  VulnerabilitySearch, 
  VulnerabilitySeverity, 
  VulnerabilitySource 
} from '../../../../../api/soroban-security-portal/models/vulnerability';
import { Report } from '../../../../../api/soroban-security-portal/models/report';
import { ProjectItem } from '../../../../../api/soroban-security-portal/models/project';
import { AuditorItem } from '../../../../../api/soroban-security-portal/models/auditor';
import { CategoryItem } from '../../../../../api/soroban-security-portal/models/category';

export const useVulnerabilities = () => {
  const [severitiesList, setSeveritiesList] = useState<VulnerabilitySeverity[]>([]);
  const [categoriesList, setCategoriesList] = useState<CategoryItem[]>([]);
  const [projectsList, setProjectsList] = useState<ProjectItem[]>([]);
  const [auditorsList, setAuditorsList] = useState<AuditorItem[]>([]);
  const [sourceList, setSourceList] = useState<VulnerabilitySource[]>([]);
  const [reportsList, setReportsList] = useState<Report[]>([]);
  const [vulnerabilitiesList, setVulnerabilitiesList] = useState<Vulnerability[]>([]);
  const dispatch = useAppDispatch();

  const getSeverities = async (): Promise<void> => {
    const response = await getSeveritiesCall();
    setSeveritiesList(response);
  };

  const getCategories = async (): Promise<void> => {
    const response = await getCategoriesCall();
    setCategoriesList(response);
  };

  const getProjects = async (): Promise<void> => {
    const response = await getProjectListDataCall();
    setProjectsList(response);
  };

  const getAuditors = async (): Promise<void> => {
    const response = await getAuditorListDataCall();
    setAuditorsList(response);
  };

  const getSource = async (): Promise<void> => {
    const response = await getSourceCall();
    setSourceList(response);
  };

  const searchVulnerabilities = async (vulnerabilitySearch?: VulnerabilitySearch): Promise<void> => {
    if (!vulnerabilitySearch) {
      vulnerabilitySearch = {
        severities: [],
        categories: [],
        projects: [],
        sources: []
      };
    }
    const response = await getVulnerabilitiesCall(vulnerabilitySearch);
    setVulnerabilitiesList(response);
  };

  const getReports = async (): Promise<void> => {
    const response = await getReportListDataCall();
    setReportsList(response);
  };

  // Set the current page
  useEffect(() => {
    void getSeverities();
    void getCategories();
    void getProjects();
    void getAuditors();
    void getSource();
    void getReports();
    void searchVulnerabilities();
  }, [dispatch]);

  return {
    severitiesList,
    categoriesList,
    projectsList,
    auditorsList,
    sourceList,
    vulnerabilitiesList,
    reportsList,
    searchVulnerabilities
  };
};
