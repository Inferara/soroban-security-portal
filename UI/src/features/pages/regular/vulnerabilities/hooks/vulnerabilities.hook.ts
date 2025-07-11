import { useEffect, useState } from 'react';
import { 
  getSeveritiesCall, 
  getCategoriesCall, 
  getProjectsCall, 
  getSourceCall, 
  getVulnerabilitiesCall 
} from '../../../../../api/soroban-security-portal/soroban-security-portal-api';
import { useAppDispatch } from '../../../../../app/hooks';
import { 
  Vulnerability,
  VulnerabilityCategory, 
  VulnerabilityProject, 
  VulnerabilitySearch, 
  VulnerabilitySeverity, 
  VulnerabilitySource 
} from '../../../../../api/soroban-security-portal/models/vulnerability';

export const useVulnerabilities = () => {
  const [severitiesList, setSeveritiesList] = useState<VulnerabilitySeverity[]>([]);
  const [categoriesList, setCategoriesList] = useState<VulnerabilityCategory[]>([]);
  const [projectsList, setProjectsList] = useState<VulnerabilityProject[]>([]);
  const [sourceList, setSourceList] = useState<VulnerabilitySource[]>([]);
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
    const response = await getProjectsCall();
    setProjectsList(response);
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

  // Set the current page
  useEffect(() => {
    void getSeverities();
    void getCategories();
    void getProjects();
    void getSource();
    void searchVulnerabilities();
  }, [dispatch]);

  return {
    severitiesList,
    categoriesList,
    projectsList,
    sourceList,
    vulnerabilitiesList,
    searchVulnerabilities
  };
};
