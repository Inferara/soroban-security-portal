import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { 
  getCompanyByIdCall,
  getProtocolListDataCall,
  getReportsCall,
  getVulnerabilitiesCall
} from '../../../../../api/soroban-security-portal/soroban-security-portal-api';
import { CompanyItem } from '../../../../../api/soroban-security-portal/models/company';
import { ProtocolItem } from '../../../../../api/soroban-security-portal/models/protocol';
import { Report } from '../../../../../api/soroban-security-portal/models/report';
import { Vulnerability, VulnerabilityCategory } from '../../../../../api/soroban-security-portal/models/vulnerability';

interface CompanyStatistics {
  totalProtocols: number;
  totalReports: number;
  totalVulnerabilities: number;
  severityBreakdown: { [key: string]: number };
  vulnerabilitiesByCategory?: { [key: number]: number };
  fixedVulnerabilities: number;
  activeVulnerabilities: number;
}

export const useCompanyDetails = () => {
  const { id } = useParams<{ id: string }>();
  const companyId = parseInt(id ?? '0');
  
  const [company, setCompany] = useState<CompanyItem | null>(null);
  const [protocols, setProtocols] = useState<ProtocolItem[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [vulnerabilities, setVulnerabilities] = useState<Vulnerability[]>([]);
  const [statistics, setStatistics] = useState<CompanyStatistics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const calculateStatistics = (
    protocols: ProtocolItem[], 
    reports: Report[], 
    vulnerabilities: Vulnerability[]
  ): CompanyStatistics => {
    const severityBreakdown: { [key: string]: number } = {};
    const vulnerabilitiesByCategory: { [key: number]: number } = {};
    let fixedCount = 0;
    let activeCount = 0;

    vulnerabilities.forEach(vuln => {
      // Count severity breakdown
      if (vuln.severity) {
        severityBreakdown[vuln.severity] = (severityBreakdown[vuln.severity] || 0) + 1;
      }
      
      // Count vulnerability categories
      vulnerabilitiesByCategory[vuln.category] = (vulnerabilitiesByCategory[vuln.category] || 0) + 1;
      
      // Count fixed vs active based on category
      if (vuln.category === VulnerabilityCategory.Valid) {
        fixedCount++;
      } else if (vuln.category === VulnerabilityCategory.ValidNotFixed) {
        activeCount++;
      }
    });

    return {
      totalProtocols: protocols.length,
      totalReports: reports.length,
      totalVulnerabilities: vulnerabilities.length,
      severityBreakdown,
      vulnerabilitiesByCategory,
      fixedVulnerabilities: fixedCount,
      activeVulnerabilities: activeCount
    };
  };

  const fetchCompanyData = async () => {
    if (!companyId) {
      setError('Invalid company ID');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Fetch company details
      const companyData = await getCompanyByIdCall(companyId);
      setCompany(companyData);

      // Fetch all protocols and filter by company ID
      const allProtocols = await getProtocolListDataCall();
      const protocolsData = allProtocols.filter(protocol => protocol.companyId === companyId);
      setProtocols(protocolsData);

      // Fetch reports for this company
      const reportsData = await getReportsCall({
        companyId: companyId
      });
      setReports(reportsData);

      // Fetch vulnerabilities for this company
      const vulnerabilitiesData = await getVulnerabilitiesCall({
        companyIds: [companyId]
      });
      setVulnerabilities(vulnerabilitiesData);

      // Calculate statistics
      const stats = calculateStatistics(protocolsData, reportsData, vulnerabilitiesData);
      setStatistics(stats);

    } catch (err: unknown) {
      console.error('Error fetching company details:', err);
      setError('Failed to load company details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCompanyData();
  }, [companyId]);

  return {
    company,
    protocols,
    reports,
    vulnerabilities,
    statistics,
    loading,
    error,
    companyId
  };
};