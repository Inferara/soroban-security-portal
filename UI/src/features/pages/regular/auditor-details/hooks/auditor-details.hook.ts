import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { 
  getAuditorByIdCall,
  getReportsCall,
  getVulnerabilitiesCall,
  getProtocolListDataCall
} from '../../../../../api/soroban-security-portal/soroban-security-portal-api';
import { AuditorItem } from '../../../../../api/soroban-security-portal/models/auditor';
import { Report } from '../../../../../api/soroban-security-portal/models/report';
import { Vulnerability, VulnerabilitySearch } from '../../../../../api/soroban-security-portal/models/vulnerability';
import { ProtocolItem } from '../../../../../api/soroban-security-portal/models/protocol';

interface AuditorStatistics {
  totalReports: number;
  totalVulnerabilities: number;
  protocolsAudited: number;
  severityBreakdown: { [key: string]: number };
  vulnerabilitiesByCategory?: { [key: number]: number };
  reportsTimeline: { month: string; count: number; }[];
}

export const useAuditorDetails = () => {
  const { id } = useParams<{ id: string }>();
  const auditorId = parseInt(id ?? '0');
  
  const [auditor, setAuditor] = useState<AuditorItem | null>(null);
  const [reports, setReports] = useState<Report[]>([]);
  const [vulnerabilities, setVulnerabilities] = useState<Vulnerability[]>([]);
  const [protocols, setProtocols] = useState<ProtocolItem[]>([]);
  const [statistics, setStatistics] = useState<AuditorStatistics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const calculateStatistics = (
    reports: Report[], 
    vulnerabilities: Vulnerability[], 
    protocols: ProtocolItem[]
  ): AuditorStatistics => {
    const severityBreakdown: { [key: string]: number } = {};
    const vulnerabilitiesByCategory: { [key: number]: number } = {};

    vulnerabilities.forEach(vuln => {
      // Count severity breakdown
      if (vuln.severity) {
        severityBreakdown[vuln.severity] = (severityBreakdown[vuln.severity] || 0) + 1;
      }
      vulnerabilitiesByCategory[vuln.category] = (vulnerabilitiesByCategory[vuln.category] || 0) + 1;
    });

    // Create timeline of reports by month
    const timeline: { [key: string]: number } = {};
    reports.forEach(report => {
      const date = new Date(report.date);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      timeline[monthKey] = (timeline[monthKey] || 0) + 1;
    });

    // Convert to array and sort by date
    const reportsTimeline = Object.entries(timeline)
      .map(([monthKey, count]) => ({
        month: monthKey,
        count
      }))
      .sort((a, b) => a.month.localeCompare(b.month))
      // .slice(-12); // Last 12 months

    // Get unique protocols from reports
    const auditedProtocolIds = new Set(reports.map(r => r.protocolId));
    const auditedProtocols = protocols.filter(p => auditedProtocolIds.has(p.id));

    return {
      totalReports: reports.length,
      totalVulnerabilities: vulnerabilities.length,
      protocolsAudited: auditedProtocols.length,
      severityBreakdown,
      vulnerabilitiesByCategory,
      reportsTimeline
    };
  };

  const fetchAuditorDetails = async () => {
    try {
      setLoading(true);
      setError(null);

      if (!auditorId || auditorId === 0) {
        console.error('Invalid auditor ID:', auditorId);
        setError('Invalid auditor ID');
        return;
      }
      
      const auditorData = await getAuditorByIdCall(auditorId);
      setAuditor(auditorData);

      // Fetch reports by this auditor
      const reportsData = await getReportsCall({
        auditorId: auditorData.id
      });
      setReports(reportsData);

      const query: VulnerabilitySearch = {
        auditorIds: [auditorData.id],
        pageSize: -1
      };
      const vulnerabilitiesData = await getVulnerabilitiesCall(query);
      setVulnerabilities(vulnerabilitiesData);

      const protocolsData = await getProtocolListDataCall();
      setProtocols(protocolsData);

      // Calculate statistics
      const stats = calculateStatistics(reportsData, vulnerabilitiesData, protocolsData);
      setStatistics(stats);

    } catch (err) {
      console.error('Error fetching auditor details:', err);
      console.error('Error details:', err);
      setError(`Failed to load auditor details: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (auditorId && auditorId > 0) {
      void fetchAuditorDetails();
    } else {
      setLoading(false);
      if (auditorId === 0) {
        setError('Invalid auditor ID from URL');
      }
    }
  }, [auditorId]);

  return {
    auditor,
    reports,
    vulnerabilities,
    protocols,
    statistics,
    loading,
    error,
    auditorId
  };
};