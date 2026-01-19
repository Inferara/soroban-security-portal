import React from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { PieChart } from '@mui/x-charts/PieChart';
import { getSeverityColor } from '../../utils/color-utils';

/**
 * Data point for the pie chart
 */
export interface PieChartDataPoint {
  id: string | number;
  value: number;
  label: string;
  color: string;
}

/**
 * Props for SeverityPieChart component
 */
export interface SeverityPieChartProps {
  /** Chart data points */
  data: PieChartDataPoint[];
  /** Card title */
  title: string;
  /** Icon to display in the title */
  titleIcon?: React.ReactNode;
  /** Message to show when no data available */
  emptyMessage?: string;
  /** Chart height (default: 300) */
  height?: number;
  /** Whether to show in a card wrapper (default: true) */
  showCard?: boolean;
}

/**
 * SeverityPieChart - A pie chart component for displaying severity or category breakdowns.
 *
 * @example Basic usage with severity breakdown:
 * ```tsx
 * const severityData = statistics
 *   ? Object.entries(statistics.severityBreakdown).map(([severity, count]) => ({
 *       id: severity,
 *       value: count,
 *       label: severity.charAt(0).toUpperCase() + severity.slice(1),
 *       color: getSeverityColor(severity)
 *     }))
 *   : [];
 *
 * <SeverityPieChart
 *   data={severityData}
 *   title="Vulnerabilities by Severity"
 * />
 * ```
 *
 * @example With custom icon:
 * ```tsx
 * <SeverityPieChart
 *   data={categoryData}
 *   title="Fix Status"
 *   titleIcon={<Grading sx={{ mr: 1, verticalAlign: 'middle' }} />}
 * />
 * ```
 */
export function SeverityPieChart({
  data,
  title,
  titleIcon,
  emptyMessage = 'No data available',
  height = 300,
  showCard = true,
}: SeverityPieChartProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const chartWidth = isMobile ? 280 : 350;

  const hasData = data.length > 0 && data.some(d => d.value > 0);

  const content = (
    <>
      <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
        {titleIcon}
        {title}
      </Typography>
      {hasData ? (
        <Box sx={{ height, display: 'flex', justifyContent: 'center' }}>
          <PieChart
            series={[
              {
                data,
                highlightScope: { fade: 'global', highlight: 'item' },
              },
            ]}
            width={chartWidth}
            height={height}
          />
        </Box>
      ) : (
        <Box
          sx={{
            height,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Typography color="text.secondary">{emptyMessage}</Typography>
        </Box>
      )}
    </>
  );

  if (!showCard) {
    return content;
  }

  return (
    <Card>
      <CardContent>{content}</CardContent>
    </Card>
  );
}

/**
 * Helper function to transform severity breakdown data for the pie chart.
 *
 * @param severityBreakdown - Object mapping severity names to counts
 * @returns Array of PieChartDataPoint
 *
 * @example
 * ```tsx
 * const chartData = transformSeverityBreakdown(statistics.severityBreakdown);
 * <SeverityPieChart data={chartData} title="Severity Breakdown" />
 * ```
 */
export function transformSeverityBreakdown(
  severityBreakdown: Record<string, number> | null | undefined
): PieChartDataPoint[] {
  if (!severityBreakdown) return [];

  return Object.entries(severityBreakdown).map(([severity, count]) => ({
    id: severity,
    value: count,
    label: severity.charAt(0).toUpperCase() + severity.slice(1),
    color: getSeverityColor(severity),
  }));
}

/**
 * Helper function to transform category breakdown data for the pie chart.
 *
 * @param categoryBreakdown - Object mapping category IDs to counts
 * @param getCategoryLabel - Function to get label for a category ID
 * @param getCategoryColor - Function to get color for a category ID
 * @returns Array of PieChartDataPoint
 *
 * @example
 * ```tsx
 * import { getCategoryLabel, getCategoryColor } from '../api/models/vulnerability';
 *
 * const chartData = transformCategoryBreakdown(
 *   statistics.vulnerabilitiesByCategory,
 *   getCategoryLabel,
 *   getCategoryColor
 * );
 * <SeverityPieChart data={chartData} title="Fix Status" />
 * ```
 */
export function transformCategoryBreakdown(
  categoryBreakdown: Record<number, number> | null | undefined,
  getCategoryLabel: (categoryId: number) => string,
  getCategoryColor: (categoryId: number) => string
): PieChartDataPoint[] {
  if (!categoryBreakdown) return [];

  return Object.entries(categoryBreakdown).map(([categoryId, count]) => ({
    id: Number(categoryId),
    value: count,
    label: getCategoryLabel(Number(categoryId)),
    color: getCategoryColor(Number(categoryId)),
  }));
}
