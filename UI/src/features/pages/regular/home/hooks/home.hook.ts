import { useState, useEffect } from 'react';
import { getVulnerabilitiesStatistics, getVulnerabilitiesStatisticsChanges, getReportStatisticsChanges, getProtocolStatisticsChanges, getAuditorStatisticsChanges } from '../../../../../api/soroban-security-portal/soroban-security-portal-api';
import { VulnerabilityStatistics, StatisticsChanges } from '../../../../../api/soroban-security-portal/models/vulnerability';

export interface VulnerabilityStatisticsBySeverity {
  critical: number;
  high: number;
  medium: number;
  low: number;
  note: number;
  total: number;
}

export interface PieChartData {
  id: string;
  value: number;
  label: string;
  color: string;
}

export type FilterType = 'severity' | 'tag' | 'protocol' | 'category';

export const useVulnerabilityStatistics = () => {
  const [vulnerabilities, setVulnerabilities] = useState<VulnerabilityStatistics>();
  const [statistics, setStatistics] = useState<VulnerabilityStatisticsBySeverity>({
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    note: 0,
    total: 0
  });
  const [pieChartData, setPieChartData] = useState<PieChartData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [vulnerabilitiesStatisticsChange, setVulnerabilitiesStatisticsChange] = useState<StatisticsChanges>();
  const [reportsStatisticsChange, setReportsStatisticsChange] = useState<StatisticsChanges>();
  const [protocolsStatisticsChange, setProtocolsStatisticsChange] = useState<StatisticsChanges>();
  const [auditorsStatisticsChange, setAuditorsStatisticsChange] = useState<StatisticsChanges>();

  const mapStatistics = (vulns: VulnerabilityStatistics): VulnerabilityStatisticsBySeverity => {
    const stats = {
      critical: vulns.bySeverity['critical'] || 0,
      high: vulns.bySeverity['high'] || 0,
      medium: vulns.bySeverity['medium'] || 0,
      low: vulns.bySeverity['low'] || 0,
      note: vulns.bySeverity['note'] || 0,
      total: vulns.total
    };
    return stats;
  };

  const generateSeverityPieChartData = (stats: VulnerabilityStatisticsBySeverity): PieChartData[] => {
    const total = stats.total || 1; // Avoid division by zero

    return [
      {
        id: 'critical',
        value: stats.critical,
        label: `${Math.round((stats.critical / total) * 100)}% Critical Issues`,
        color: '#c72e2b95' // Red
      },
      {
        id: 'high',
        value: stats.high,
        label: `${Math.round((stats.high / total) * 100)}%  High Issues`,
        color: '#FF6B3D95' // Orange
      },
      {
        id: 'medium',
        value: stats.medium,
        label: `${Math.round((stats.medium / total) * 100)}% Medium Issues`,
        color: '#FFD84D95' // Yellow
      },
      {
        id: 'low',
        value: stats.low,
        label: `${Math.round((stats.low / total) * 100)}% Low Issues`,
        color: '#569E6795' // Green
      },
      {
        id: 'note',
        value: stats.note,
        label: `${Math.round((stats.note / total) * 100)}% Note Issues`,
        color: '#72F1FF95' // Blue
      }
    ].filter(item => item.value > 0); // Only show segments with data
  };

  const generateTagPieChartData = (vulns: VulnerabilityStatistics): PieChartData[] => {
    const tagCounts = new Map<string, number>();

    Object.entries(vulns.byTag).forEach(([tag, count]) => {
      tagCounts.set(tag, count);
    });

    const total = vulns.total || 1;
    const colors = ['#1976d2', '#42a5f5', '#90caf9', '#bbdefb', '#e3f2fd', '#2196f3', '#21cbf3', '#64b5f6'];

    return Array.from(tagCounts.entries()).map(([tag, count], index) => ({
      id: tag,
      value: count,
      label: `${Math.round((count / total) * 100)}% ${tag}`,
      color: colors[index % colors.length]
    }));
  };

  const generateCategoryPieChartData = (vulns: VulnerabilityStatistics): PieChartData[] => {
    const categoryCounts = new Map<string, number>();
    Object.entries(vulns.byCategory).forEach(([category, count]) => {
      categoryCounts.set(category, count);
    });

    const total = vulns.total || 1;
    const colors = ['#6a1b9a', '#9c27b0', '#ba68c8', '#ce93d8', '#e1bee7'];
    return Array.from(categoryCounts.entries()).map(([category, count], index) => ({
      id: category,
      value: count,
      label: `${Math.round((count / total) * 100)}% ${category}`,
      color: colors[index % colors.length]
    }));
  }

  // const generateProtocolPieChartData = (vulns: VulnerabilityStatistics): PieChartData[] => {
  //   const protocolCounts = new Map<string, number>();

  //   vulns.forEach(vuln => {
  //     const protocol = vuln.protocol || 'Unknown';
  //     protocolCounts.set(protocol, (protocolCounts.get(protocol) || 0) + 1);
  //   });

  //   const total = vulns.length || 1;
  //   const colors = ['#388e3c', '#4caf50', '#66bb6a', '#81c784', '#a5d6a7', '#c8e6c9', '#2e7d32', '#1b5e20'];

  //   return Array.from(protocolCounts.entries()).map(([protocol, count], index) => ({
  //     id: protocol,
  //     value: count,
  //     label: `${Math.round((count / total) * 100)}% ${protocol}`,
  //     color: colors[index % colors.length]
  //   }));
  // };

  const generatePieChartData = (filterType: FilterType, vulns: VulnerabilityStatistics, stats?: VulnerabilityStatisticsBySeverity): PieChartData[] => {
    switch (filterType) {
      case 'severity':
        return generateSeverityPieChartData(stats || mapStatistics(vulns));
      case 'tag':
        return generateTagPieChartData(vulns);
      case 'category':
        return generateCategoryPieChartData(vulns);
      default:
        return generateSeverityPieChartData(stats || mapStatistics(vulns));
    }
  };

  const updatePieChartData = (filterType: FilterType) => {
    const stats = mapStatistics(vulnerabilities!);
    const pieData = generatePieChartData(filterType, vulnerabilities!, stats);
    setPieChartData(pieData);
  };

  const loadStatistics = async () => {
    try {
      setLoading(true);
      setError(null);

      const vulns = await getVulnerabilitiesStatistics();
      setVulnerabilities(vulns);

      const stats = mapStatistics(vulns);
      setStatistics(stats);

      const vulnerabilitiesStatisticsChange = await getVulnerabilitiesStatisticsChanges();
      setVulnerabilitiesStatisticsChange(vulnerabilitiesStatisticsChange);
      const reportsStatisticsChange = await getReportStatisticsChanges();
      setReportsStatisticsChange(reportsStatisticsChange);
      const protocolsStatisticsChange = await getProtocolStatisticsChanges();
      setProtocolsStatisticsChange(protocolsStatisticsChange);
      const auditorsStatisticsChange = await getAuditorStatisticsChanges();
      setAuditorsStatisticsChange(auditorsStatisticsChange);

      const pieData = generatePieChartData('severity', vulns, stats);
      setPieChartData(pieData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load vulnerabilities');
      console.error('Error loading vulnerabilities:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStatistics();
  }, []);

  return {
    vulnerabilities,
    statistics,
    pieChartData,
    loading,
    error,
    vulnerabilitiesStatisticsChange,
    reportsStatisticsChange,
    protocolsStatisticsChange,
    auditorsStatisticsChange,
    refresh: loadStatistics,
    updatePieChartData
  };
};