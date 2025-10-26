import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from 'react-oidc-context';
import { environment } from '../../../../../environments/environment';
import { 
  getReportByIdCall,
  getProtocolByIdCall,
  getAuditorByIdCall,
  getCompanyByIdCall,
  getVulnerabilitiesCall
} from '../../../../../api/soroban-security-portal/soroban-security-portal-api';
import { Report } from '../../../../../api/soroban-security-portal/models/report';
import { ProtocolItem } from '../../../../../api/soroban-security-portal/models/protocol';
import { AuditorItem } from '../../../../../api/soroban-security-portal/models/auditor';
import { CompanyItem } from '../../../../../api/soroban-security-portal/models/company';
import { Vulnerability, VulnerabilitySearch } from '../../../../../api/soroban-security-portal/models/vulnerability';

interface ReportStatistics {
  totalVulnerabilities: number;
  severityBreakdown: { [key: string]: number };
  vulnerabilitiesByCategory?: { [key: number]: number };
}

export const useReportDetails = () => {
  const { id } = useParams<{ id: string }>();
  const reportId = parseInt(id ?? '0');
  const auth = useAuth();
  
  const [report, setReport] = useState<Report | null>(null);
  const [protocol, setProtocol] = useState<ProtocolItem | null>(null);
  const [auditor, setAuditor] = useState<AuditorItem | null>(null);
  const [company, setCompany] = useState<CompanyItem | null>(null);
  const [vulnerabilities, setVulnerabilities] = useState<Vulnerability[]>([]);
  const [statistics, setStatistics] = useState<ReportStatistics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // PDF handling state
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfLoadError, setPdfLoadError] = useState(false);

  const calculateStatistics = (vulnerabilities: Vulnerability[]): ReportStatistics => {
    const severityBreakdown: { [key: string]: number } = {};
    const vulnerabilitiesByCategory: { [key: number]: number } = {};

    vulnerabilities.forEach(vuln => {
      // Count severity breakdown
      if (vuln.severity) {
        severityBreakdown[vuln.severity] = (severityBreakdown[vuln.severity] || 0) + 1;
      }
      // Count by category
      vulnerabilitiesByCategory[vuln.category] = (vulnerabilitiesByCategory[vuln.category] || 0) + 1;
    });

    return {
      totalVulnerabilities: vulnerabilities.length,
      severityBreakdown,
      vulnerabilitiesByCategory,
    };
  };

  const fetchPdfForViewing = async () => {
    if (!reportId || !auth.user?.access_token) {
      return;
    }

    setPdfLoading(true);
    setPdfLoadError(false);

    try {
      const response = await fetch(`${environment.apiUrl}/api/v1/reports/${reportId}/download`, {
        headers: {
          'Authorization': `Bearer ${auth.user.access_token}`,
          'Content-Type': 'application/pdf'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      setPdfBlobUrl(url);
    } catch (error) {
      console.error('Error fetching PDF:', error);
      setPdfLoadError(true);
    } finally {
      setPdfLoading(false);
    }
  };

  const retryPdfLoad = () => {
    setPdfLoadError(false);
    setPdfBlobUrl(null);
    fetchPdfForViewing();
  };

  // Cleanup blob URL when component unmounts
  useEffect(() => {
    return () => {
      if (pdfBlobUrl) {
        URL.revokeObjectURL(pdfBlobUrl);
      }
    };
  }, [pdfBlobUrl]);

  const fetchReportDetails = async () => {
    try {
      setLoading(true);
      setError(null);

      if (!reportId) {
        setError('Invalid report ID');
        return;
      }

      // Fetch report details
      const reportData = await getReportByIdCall(reportId);
      setReport(reportData);

      // Fetch related entities in parallel
      const promises = [];
      
      if (reportData.protocolId) {
        promises.push(getProtocolByIdCall(reportData.protocolId));
      } else {
        promises.push(Promise.resolve(null));
      }
      
      if (reportData.auditorId) {
        promises.push(getAuditorByIdCall(reportData.auditorId));
      } else {
        promises.push(Promise.resolve(null));
      }

      if (reportData.companyId) {
        promises.push(getCompanyByIdCall(reportData.companyId));
      } else {
        promises.push(Promise.resolve(null));
      }

      const [protocolData, auditorData, companyData] = await Promise.all(promises);
      
      setProtocol(protocolData as ProtocolItem | null);
      setAuditor(auditorData as AuditorItem | null);
      setCompany(companyData as CompanyItem | null);

      // Fetch vulnerabilities for this report
      const query: VulnerabilitySearch = {
        reports: [reportData.name],
        pageSize: -1
      };
      const vulnerabilitiesData = await getVulnerabilitiesCall(query);
      setVulnerabilities(vulnerabilitiesData);

      // Calculate statistics
      const stats = calculateStatistics(vulnerabilitiesData);
      setStatistics(stats);

    } catch (err) {
      console.error('Error fetching report details:', err);
      setError('Failed to load report details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (reportId) {
      void fetchReportDetails();
    }
  }, [reportId]);

  return {
    report,
    protocol,
    auditor,
    company,
    vulnerabilities,
    statistics,
    loading,
    error,
    reportId,
    // PDF handling
    pdfBlobUrl,
    pdfLoading,
    pdfLoadError,
    fetchPdfForViewing,
    retryPdfLoad
  };
};