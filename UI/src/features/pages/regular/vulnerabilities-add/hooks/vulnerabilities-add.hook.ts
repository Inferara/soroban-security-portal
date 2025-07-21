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
  VulnerabilitySeverity, 
  VulnerabilitySource, 
} from '../../../../../api/soroban-security-portal/models/vulnerability';
import { ProjectItem } from '../../../../../api/soroban-security-portal/models/project';
import { AuditorItem } from '../../../../../api/soroban-security-portal/models/auditor';
import { CategoryItem } from '../../../../../api/soroban-security-portal/models/category';
import { v4 } from 'uuid';

export const useVulnerabilityAdd = () => {
  const [severitiesList, setSeveritiesList] = useState<VulnerabilitySeverity[]>([]);
  const [categoriesList, setCategoriesList] = useState<CategoryItem[]>([]);
  const [projectsList, setProjectsList] = useState<ProjectItem[]>([]);
  const [sourceList, setSourceList] = useState<VulnerabilitySource[]>([]);
  const [auditorsList, setAuditorsList] = useState<AuditorItem[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [picturesContainerGuid] = useState(v4());
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

  const addVulnerability = async (vulnerability: Vulnerability, images?: File[]): Promise<void> => {
    setIsUploading(true);
    try {       
      const formData = new FormData();
      formData.append('vulnerability', JSON.stringify(vulnerability));
      if (images && images.length > 0){
        images.forEach((image) => {
          formData.append(`images`, image);
        });
      }      
      const response = await addVulnerabilityCall(formData);
      console.log('Vulnerability added with images:', response);

    } catch (error) {
      console.error('Error adding vulnerability:', error);
      throw error;
    } finally {
      setIsUploading(false);
    }
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
    isUploading,
    picturesContainerGuid,
  };
};
