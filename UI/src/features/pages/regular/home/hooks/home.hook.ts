import { useState, useEffect } from 'react';
import { useAuth } from 'react-oidc-context';
import { getVulnerabilitiesStatistics, getVulnerabilitiesStatisticsChanges, getReportStatisticsChanges, getProtocolStatisticsChanges, getAuditorStatisticsChanges } from '../../../../../api/soroban-security-portal/soroban-security-portal-api';
import { VulnerabilityStatistics, StatisticsChanges, getCategoryIdByLabel, VulnerabilityCategories } from '../../../../../api/soroban-security-portal/models/vulnerability';
import { SeverityColors } from '../../../../../contexts/ThemeContext';

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
  const auth = useAuth();

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

  const mapStatistics = (vulns?: VulnerabilityStatistics): VulnerabilityStatisticsBySeverity => {
    if (!vulns) {
      return {
        critical: 0,
        high: 0,
        medium: 0,
        low: 0,
        note: 0,
        total: 0
      };
    }
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
        color: SeverityColors['critical']
      },
      {
        id: 'high',
        value: stats.high,
        label: `${Math.round((stats.high / total) * 100)}%  High Issues`,
        color: SeverityColors['high']
      },
      {
        id: 'medium',
        value: stats.medium,
        label: `${Math.round((stats.medium / total) * 100)}% Medium Issues`,
        color: SeverityColors['medium']
      },
      {
        id: 'low',
        value: stats.low,
        label: `${Math.round((stats.low / total) * 100)}% Low Issues`,
        color: SeverityColors['low']
      },
      {
        id: 'note',
        value: stats.note,
        label: `${Math.round((stats.note / total) * 100)}% Note Issues`,
        color: SeverityColors['note']
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
    const colors = [
      VulnerabilityCategories[0].color,
      VulnerabilityCategories[1].color,
      VulnerabilityCategories[2].color,
      VulnerabilityCategories[4].color
    ];

    return Array.from(categoryCounts.entries()).map(([category, count], index) => ({
      id: category,
      value: count,
      label: `${Math.round((count / total) * 100)}% ${category}`,
      color: colors[index % colors.length]
    })).sort((a, b) => {
      const aId = getCategoryIdByLabel(a.id)!;
      const bId = getCategoryIdByLabel(b.id)!;
      return aId - bId;
    });
  }

  const generatePieChartData = (filterType: FilterType, vulns?: VulnerabilityStatistics, stats?: VulnerabilityStatisticsBySeverity): PieChartData[] => {
    switch (filterType) {
      case 'severity':
        return generateSeverityPieChartData(stats || mapStatistics(vulns));
      case 'tag':
        return vulns ? generateTagPieChartData(vulns) : [];
      case 'category':
        return vulns ? generateCategoryPieChartData(vulns) : [];
      default:
        return generateSeverityPieChartData(stats || mapStatistics(vulns));
    }
  };

  const updatePieChartData = (filterType: FilterType) => {
    const stats = mapStatistics(vulnerabilities);
    const pieData = generatePieChartData(filterType, vulnerabilities, stats);
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
      const message = err instanceof Error ? err.message : 'Failed to load vulnerabilities';
      // For unauthenticated users, silently fall back to empty data instead of surfacing auth errors
      if (!auth.isAuthenticated && message.toLowerCase().includes('authentication required')) {
        const emptyStats = mapStatistics(undefined);
        setVulnerabilities(undefined);
        setStatistics(emptyStats);
        setVulnerabilitiesStatisticsChange(undefined);
        setReportsStatisticsChange(undefined);
        setProtocolsStatisticsChange(undefined);
        setAuditorsStatisticsChange(undefined);
        setPieChartData([]);
      } else {
        setError(message);
        console.error('Error loading vulnerabilities:', err);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStatistics();
    // Rerun when authentication state changes (login or logout)
  }, [auth.isAuthenticated]);

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
