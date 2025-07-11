import { useEffect, useState } from 'react';
import { 
  getSeveritiesCall, 
  getCategoriesCall, 
  getProjectsCall, 
  getSourceCall, 
  addVulnerabilityCall, 
} from '../../../../../api/soroban-security-portal/soroban-security-portal-api';
import { useAppDispatch } from '../../../../../app/hooks';
import { 
  Vulnerability,
  VulnerabilityCategory, 
  VulnerabilityProject, 
  VulnerabilitySeverity, 
  VulnerabilitySource, 
} from '../../../../../api/soroban-security-portal/models/vulnerability';

export const useVulnerabilityAdd = () => {
  const [severitiesList, setSeveritiesList] = useState<VulnerabilitySeverity[]>([]);
  const [categoriesList, setCategoriesList] = useState<VulnerabilityCategory[]>([]);
  const [projectsList, setProjectsList] = useState<VulnerabilityProject[]>([]);
  const [sourceList, setSourceList] = useState<VulnerabilitySource[]>([]);
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

  const addVulnerability = async (vulnerability: Vulnerability): Promise<void> => {
    const response = await addVulnerabilityCall(vulnerability);
    console.log(response);
  };

  // Set the current page
  useEffect(() => {
    void getSeverities();
    void getCategories();
    void getProjects();
    void getSource();
  }, [dispatch]);

  return {
    severitiesList,
    categoriesList,
    projectsList,
    sourceList,
    addVulnerability,
  };
};
