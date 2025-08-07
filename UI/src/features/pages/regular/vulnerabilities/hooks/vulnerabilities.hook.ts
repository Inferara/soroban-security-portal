import { useEffect, useState } from 'react';
import { 
  getSeveritiesCall, 
  getCategoriesCall, 
  getProtocolListDataCall, 
  getAuditorListDataCall,
  getSourceCall, 
  getVulnerabilitiesCall,
  getReportListDataCall,
  getCompanyListDataCall
} from '../../../../../api/soroban-security-portal/soroban-security-portal-api';
import { useAppDispatch } from '../../../../../app/hooks';
import { 
  Vulnerability,
  VulnerabilitySearch, 
  VulnerabilitySeverity, 
  VulnerabilitySource 
} from '../../../../../api/soroban-security-portal/models/vulnerability';
import { Report } from '../../../../../api/soroban-security-portal/models/report';
import { ProtocolItem } from '../../../../../api/soroban-security-portal/models/protocol';
import { AuditorItem } from '../../../../../api/soroban-security-portal/models/auditor';
import { CategoryItem } from '../../../../../api/soroban-security-portal/models/category';
import { CompanyItem } from '../../../../../api/soroban-security-portal/models/company';

export const useVulnerabilities = () => {
  const [severitiesList, setSeveritiesList] = useState<VulnerabilitySeverity[]>([]);
  const [categoriesList, setCategoriesList] = useState<CategoryItem[]>([]);
  const [protocolsList, setProtocolsList] = useState<ProtocolItem[]>([]);
  const [companiesList, setCompaniesList] = useState<CompanyItem[]>([]);
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

  const searchVulnerabilities = async (vulnerabilitySearch?: VulnerabilitySearch): Promise<void> => {
    if (!vulnerabilitySearch) {
      vulnerabilitySearch = {
        severities: [],
        categories: [],
        protocols: [],
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
    void getCompanies();
    void getProtocols();
    void getAuditors();
    void getSource();
    void getReports();
    void searchVulnerabilities();
  }, [dispatch]);

  return {
    severitiesList,
    categoriesList,
    companiesList,
    protocolsList,
    auditorsList,
    sourceList,
    vulnerabilitiesList,
    reportsList,
    searchVulnerabilities
  };
};
