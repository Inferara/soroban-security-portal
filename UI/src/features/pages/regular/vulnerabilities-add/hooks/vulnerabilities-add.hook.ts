import { useEffect, useState } from 'react';
import { 
  getSeveritiesCall, 
  getCategoriesCall, 
  getProjectListDataCall, 
  getSourceCall, 
  addVulnerabilityCall, 
  getAuditorListDataCall,
} from '../../../../../api/soroban-security-portal/soroban-security-portal-api';
import { useAppDispatch } from '../../../../../app/hooks';
import { 
  Vulnerability,
  VulnerabilityCategory, 
  VulnerabilitySeverity, 
  VulnerabilitySource, 
} from '../../../../../api/soroban-security-portal/models/vulnerability';
import { ProjectItem } from '../../../../../api/soroban-security-portal/models/project';
import { AuditorItem } from '../../../../../api/soroban-security-portal/models/auditor';

export const useVulnerabilityAdd = () => {
  const [severitiesList, setSeveritiesList] = useState<VulnerabilitySeverity[]>([]);
  const [categoriesList, setCategoriesList] = useState<VulnerabilityCategory[]>([]);
  const [projectsList, setProjectsList] = useState<ProjectItem[]>([]);
  const [sourceList, setSourceList] = useState<VulnerabilitySource[]>([]);
  const [auditorsList, setAuditorsList] = useState<AuditorItem[]>([]);
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

  const addVulnerability = async (vulnerability: Vulnerability): Promise<void> => {
    const response = await addVulnerabilityCall(vulnerability);
    console.log(response);
  };

  // Set the current page
  useEffect(() => {
    void getSeverities();
    void getCategories();
    void getProjects();
    void getAuditors();
    void getSource();
  }, [dispatch]);

  return {
    severitiesList,
    categoriesList,
    projectsList,
    auditorsList,
    sourceList,
    addVulnerability,
  };
};
