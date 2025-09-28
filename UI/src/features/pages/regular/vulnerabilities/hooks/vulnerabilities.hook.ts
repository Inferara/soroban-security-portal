import { useEffect, useState } from 'react';
import { 
  getSeveritiesCall, 
  getTagsCall, 
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
  VulnerabilitySource,
} from '../../../../../api/soroban-security-portal/models/vulnerability';
import { Report } from '../../../../../api/soroban-security-portal/models/report';
import { ProtocolItem } from '../../../../../api/soroban-security-portal/models/protocol';
import { AuditorItem } from '../../../../../api/soroban-security-portal/models/auditor';
import { TagItem } from '../../../../../api/soroban-security-portal/models/tag';
import { CompanyItem } from '../../../../../api/soroban-security-portal/models/company';

export const useVulnerabilities = () => {
  const [severitiesList, setSeveritiesList] = useState<VulnerabilitySeverity[]>([]);
  const [tagsList, setTagsList] = useState<TagItem[]>([]);
  const [protocolsList, setProtocolsList] = useState<ProtocolItem[]>([]);
  const [companiesList, setCompaniesList] = useState<CompanyItem[]>([]);
  const [auditorsList, setAuditorsList] = useState<AuditorItem[]>([]);
  const [sourceList, setSourceList] = useState<VulnerabilitySource[]>([]);
  const [reportsList, setReportsList] = useState<Report[]>([]);
  const [vulnerabilitiesList, setVulnerabilitiesList] = useState<Vulnerability[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [isLoadingInitial, setIsLoadingInitial] = useState(true);
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

  const searchVulnerabilities = async (vulnerabilitySearch?: VulnerabilitySearch): Promise<void> => {
    if (!vulnerabilitySearch) {
      vulnerabilitySearch = {
        severities: [],
        tags: [],
        protocols: [],
        reports: [],
        page: currentPage,
        pageSize: pageSize
      };
    } else {
      vulnerabilitySearch.page = vulnerabilitySearch.page || currentPage;
      vulnerabilitySearch.pageSize = vulnerabilitySearch.pageSize || pageSize;
    }
    setIsLoadingInitial(true);
    const response = await getVulnerabilitiesCall(vulnerabilitySearch);
    setVulnerabilitiesList(response);
    await getTotalItems(vulnerabilitySearch);
    setIsLoadingInitial(false);
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
    void getTags();
    void getCompanies();
    void getProtocols();
    void getAuditors();
    void getSource();
    void getReports();

    // Initial search with pagination
    void searchVulnerabilities({
      severities: [],
      tags: [],
      protocols: [],
      reports: [],
      page: 1,
      pageSize: 10
    });
  }, [dispatch]);

  return {
    severitiesList,
    tagsList,
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
    setItemsPerPage,
    isLoadingInitial
  };
};
