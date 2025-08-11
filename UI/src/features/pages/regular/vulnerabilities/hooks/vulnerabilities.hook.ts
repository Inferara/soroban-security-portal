import { useEffect, useState } from 'react';
import { 
  getSeveritiesCall, 
  getCategoriesCall, 
  getProtocolListDataCall, 
  getAuditorListDataCall,
  getSourceCall, 
  getVulnerabilitiesCall,
  getReportListDataCall,
  getCompanyListDataCall,
  getVulnerabilitiesTotalCall
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
  const [totalItems, setTotalItems] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
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
        sources: [],
        page: currentPage,
        pageSize: pageSize
      };
    } else {
      vulnerabilitySearch.page = vulnerabilitySearch.page || currentPage;
      vulnerabilitySearch.pageSize = vulnerabilitySearch.pageSize || pageSize;
    }
    const response = await getVulnerabilitiesCall(vulnerabilitySearch);
    setVulnerabilitiesList(response);
    await getTotalItems(vulnerabilitySearch);
  };

  const getTotalItems = async (vulnerabilitySearch?: VulnerabilitySearch): Promise<void> => {
    const response = await getVulnerabilitiesTotalCall(vulnerabilitySearch);
    setTotalItems(response);
  };

  const getReports = async (): Promise<void> => {
    const response = await getReportListDataCall();
    setReportsList(response);
  };

  const setPage = (page: number) => {
    setCurrentPage(page);
  };

  const setItemsPerPage = (size: number) => {
    setPageSize(size);
    setCurrentPage(1);
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
    // Initial search with pagination
    void searchVulnerabilities({
      severities: [],
      categories: [],
      protocols: [],
      sources: [],
      page: 1,
      pageSize: 10
    });
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
    searchVulnerabilities,
    totalItems,
    currentPage,
    pageSize,
    setPage,
    setItemsPerPage
  };
};
