import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { 
  getProtocolByIdCall,
  getCompanyByIdCall,
  getReportsCall,
  getVulnerabilitiesCall
} from '../../../../../api/soroban-security-portal/soroban-security-portal-api';
import { ProtocolItem } from '../../../../../api/soroban-security-portal/models/protocol';
import { CompanyItem } from '../../../../../api/soroban-security-portal/models/company';
import { Report } from '../../../../../api/soroban-security-portal/models/report';
import { Vulnerability } from '../../../../../api/soroban-security-portal/models/vulnerability';

interface ProtocolStatistics {
  totalReports: number;
  totalVulnerabilities: number;
  severityBreakdown: { [key: string]: number };
  vulnerabilitiesByCategory?: { [key: number]: number };
  fixedVulnerabilities: number;
  activeVulnerabilities: number;
}

export const useProtocolDetails = () => {
  const { id } = useParams<{ id: string }>();
  const protocolId = parseInt(id ?? '0');
  
  const [protocol, setProtocol] = useState<ProtocolItem | null>(null);
  const [company, setCompany] = useState<CompanyItem | null>(null);
  const [reports, setReports] = useState<Report[]>([]);
  const [vulnerabilities, setVulnerabilities] = useState<Vulnerability[]>([]);
  const [statistics, setStatistics] = useState<ProtocolStatistics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const calculateStatistics = (reports: Report[], vulnerabilities: Vulnerability[]): ProtocolStatistics => {
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
      
      // Count fixed vs active
      if (vuln.status?.toLowerCase() === 'fixed') {
        fixedCount++;
      } else {
        activeCount++;
      }
    });

    return {
      totalReports: reports.length,
      totalVulnerabilities: vulnerabilities.length,
      severityBreakdown,
      vulnerabilitiesByCategory,
      fixedVulnerabilities: fixedCount,
      activeVulnerabilities: activeCount
    };
  };

  const fetchProtocolDetails = async () => {
    try {
      setLoading(true);
      setError(null);

      if (!protocolId) {
        setError('Invalid protocol ID');
        return;
      }

      // Fetch protocol details
      const protocolData = await getProtocolByIdCall(protocolId);
      setProtocol(protocolData);

      // Fetch company details if protocol has a company
      let companyData = null;
      if (protocolData.companyId) {
        companyData = await getCompanyByIdCall(protocolData.companyId);
        setCompany(companyData);
      }

      // Fetch reports for this protocol
      const reportsData = await getReportsCall({
        protocolName: protocolData.name
      });
      setReports(reportsData);

      // Fetch vulnerabilities for this protocol
      const vulnerabilitiesData = await getVulnerabilitiesCall({
        protocols: [protocolData.name],
        page: 1,
        pageSize: 1000 // Get all vulnerabilities for statistics
      });
      setVulnerabilities(vulnerabilitiesData);

      // Calculate statistics
      const stats = calculateStatistics(reportsData, vulnerabilitiesData);
      setStatistics(stats);

    } catch (err) {
      console.error('Error fetching protocol details:', err);
      setError('Failed to load protocol details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (protocolId) {
      void fetchProtocolDetails();
    }
  }, [protocolId]);

  return {
    protocol,
    company,
    reports,
    vulnerabilities,
    statistics,
    loading,
    error,
    protocolId
  };
};