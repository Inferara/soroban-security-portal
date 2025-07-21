import { useState, useEffect } from 'react';
import { getVulnerabilitiesCall } from '../../../../../api/soroban-security-portal/soroban-security-portal-api';
import { Vulnerability } from '../../../../../api/soroban-security-portal/models/vulnerability';

export interface VulnerabilityStatistics {
  critical: number;
  high: number;
  medium: number;
  low: number;
  info: number;
  total: number;
}

export interface PieChartData {
  id: string;
  value: number;
  label: string;
  color: string;
}

export type FilterType = 'severity' | 'category' | 'project' | 'source';

export const useVulnerabilityStatistics = () => {
  const [vulnerabilities, setVulnerabilities] = useState<Vulnerability[]>([]);
  const [statistics, setStatistics] = useState<VulnerabilityStatistics>({
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    info: 0,
    total: 0
  });
  const [pieChartData, setPieChartData] = useState<PieChartData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const calculateStatistics = (vulns: Vulnerability[]): VulnerabilityStatistics => {
    const stats = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      info: 0,
      total: vulns.length
    };

    vulns.forEach(vuln => {
      const severity = vuln.severity.toLowerCase();
      switch (severity) {
        case 'critical':
          stats.critical++;
          break;
        case 'high':
          stats.high++;
          break;
        case 'medium':
          stats.medium++;
          break;
        case 'low':
          stats.low++;
          break;
        case 'info':
          stats.info++;
          break;
        default:
          // If severity doesn't match expected values, count as medium
          stats.medium++;
          break;
      }
    });

    return stats;
  };

  const generateSeverityPieChartData = (stats: VulnerabilityStatistics): PieChartData[] => {
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
        id: 'info',
        value: stats.info,
        label: `${Math.round((stats.info / total) * 100)}% Info Issues`,
        color: '#72F1FF95' // Blue
      }
    ].filter(item => item.value > 0); // Only show segments with data
  };

  const generateCategoryPieChartData = (vulns: Vulnerability[]): PieChartData[] => {
    const categoryCounts = new Map<string, number>();
    
    vulns.forEach(vuln => {
      // Handle categories array - count each category
      if (vuln.categories && vuln.categories.length > 0) {
        vuln.categories.forEach(category => {
          categoryCounts.set(category, (categoryCounts.get(category) || 0) + 1);
        });
      } else {
        categoryCounts.set('Unknown', (categoryCounts.get('Unknown') || 0) + 1);
      }
    });

    const total = vulns.length || 1;
    const colors = ['#1976d2', '#42a5f5', '#90caf9', '#bbdefb', '#e3f2fd', '#2196f3', '#21cbf3', '#64b5f6'];
    
    return Array.from(categoryCounts.entries()).map(([category, count], index) => ({
      id: category,
      value: count,
      label: `${Math.round((count / total) * 100)}% ${category}`,
      color: colors[index % colors.length]
    }));
  };

  const generateProjectPieChartData = (vulns: Vulnerability[]): PieChartData[] => {
    const projectCounts = new Map<string, number>();
    
    vulns.forEach(vuln => {
      const project = vuln.project || 'Unknown';
      projectCounts.set(project, (projectCounts.get(project) || 0) + 1);
    });

    const total = vulns.length || 1;
    const colors = ['#388e3c', '#4caf50', '#66bb6a', '#81c784', '#a5d6a7', '#c8e6c9', '#2e7d32', '#1b5e20'];
    
    return Array.from(projectCounts.entries()).map(([project, count], index) => ({
      id: project,
      value: count,
      label: `${Math.round((count / total) * 100)}% ${project}`,
      color: colors[index % colors.length]
    }));
  };

  const generatePieChartData = (filterType: FilterType, vulns: Vulnerability[], stats?: VulnerabilityStatistics): PieChartData[] => {
    switch (filterType) {
      case 'severity':
        return generateSeverityPieChartData(stats || calculateStatistics(vulns));
      case 'category':
        return generateCategoryPieChartData(vulns);
      case 'project':
        return generateProjectPieChartData(vulns);
      default:
        return generateSeverityPieChartData(stats || calculateStatistics(vulns));
    }
  };

  const updatePieChartData = (filterType: FilterType) => {
    const stats = calculateStatistics(vulnerabilities);
    const pieData = generatePieChartData(filterType, vulnerabilities, stats);
    setPieChartData(pieData);
  };

  const loadVulnerabilities = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const vulns = await getVulnerabilitiesCall();
      setVulnerabilities(vulns);
      
      const stats = calculateStatistics(vulns);
      setStatistics(stats);
      
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
    loadVulnerabilities();
  }, []);

  return {
    vulnerabilities,
    statistics,
    pieChartData,
    loading,
    error,
    refresh: loadVulnerabilities,
    updatePieChartData
  };
}; 