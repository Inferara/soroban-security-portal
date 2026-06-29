import { useEffect, useState } from 'react';
import { 
  getSeveritiesCall, 
  getTagsCall, 
  getProtocolListDataCall, 
  getSourceCall, 
  addVulnerabilityCall, 
  getAuditorListDataCall,
  getCompanyListDataCall,
} from '../../../../../api/soroban-security-portal/soroban-security-portal-api';
import { useAppDispatch } from '../../../../../app/hooks';
import { 
  Vulnerability, 
  VulnerabilitySeverity, 
  VulnerabilitySource, 
} from '../../../../../api/soroban-security-portal/models/vulnerability';
import { ProtocolItem } from '../../../../../api/soroban-security-portal/models/protocol';
import { CompanyItem } from '../../../../../api/soroban-security-portal/models/company';
import { AuditorItem } from '../../../../../api/soroban-security-portal/models/auditor';
import { TagItem } from '../../../../../api/soroban-security-portal/models/tag';
import { v4 } from 'uuid';

export const useVulnerabilityAdd = () => {
  const [severitiesList, setSeveritiesList] = useState<VulnerabilitySeverity[]>([]);
  const [tagsList, setTagsList] = useState<TagItem[]>([]);
  const [protocolsList, setProtocolsList] = useState<ProtocolItem[]>([]);
  const [companiesList, setCompaniesList] = useState<CompanyItem[]>([]);
  const [sourceList, setSourceList] = useState<VulnerabilitySource[]>([]);
  const [auditorsList, setAuditorsList] = useState<AuditorItem[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [picturesContainerGuid] = useState(v4());
  const dispatch = useAppDispatch();

  const getSeverities = async (): Promise<void> => {
    const response = await getSeveritiesCall();
    setSeveritiesList(response);
  };

  const getTags = async (): Promise<void> => {
    const response = await getTagsCall();
    setTagsList(response);
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
    void getTags();
    void getProtocols();
    void getCompanies();
    void getAuditors();
    void getSource();
  }, [dispatch]);

  return {
    severitiesList,
    tagsList,
    protocolsList,
    companiesList,
    auditorsList,
    sourceList,
    addVulnerability,
    isUploading,
    picturesContainerGuid,
  };
};
