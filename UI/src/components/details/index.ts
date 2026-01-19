/**
 * Detail page components for displaying entity information.
 *
 * These components eliminate code duplication across detail pages
 * (auditor-details, company-details, protocol-details, report-details, vulnerability-details).
 *
 * @example Usage in a detail page:
 * ```tsx
 * import {
 *   DetailPageLayout,
 *   DetailPageHeader,
 *   StatisticsCards,
 *   DetailTabs,
 *   useDetailTabs,
 *   EntityListCard,
 *   SeverityPieChart,
 *   transformSeverityBreakdown,
 * } from '../../components/details';
 *
 * export const AuditorDetails: FC = () => {
 *   const { auditor, statistics, loading, error } = useAuditorDetails();
 *   const { tabValue, tabProps } = useDetailTabs(0);
 *
 *   return (
 *     <DetailPageLayout
 *       loading={loading}
 *       error={error}
 *       entity={auditor}
 *       entityName="Auditor"
 *     >
 *       <DetailPageHeader
 *         entityType="auditor"
 *         entityId={auditor.id}
 *         title={auditor.name}
 *         subtitle="Security Auditor"
 *       />
 *       <StatisticsCards cards={statsCards} />
 *       <DetailTabs tabs={tabs} {...tabProps} />
 *       {tabValue === 0 && <OverviewContent />}
 *       {tabValue === 1 && <ActivityContent />}
 *     </DetailPageLayout>
 *   );
 * };
 * ```
 */

// Layout and structure
export { DetailPageLayout } from './DetailPageLayout';
export type { DetailPageLayoutProps } from './DetailPageLayout';

// Header
export { DetailPageHeader } from './DetailPageHeader';
export type { DetailPageHeaderProps } from './DetailPageHeader';

// Statistics
export { StatisticsCards } from './StatisticsCards';
export type { StatisticsCardsProps, StatisticCard } from './StatisticsCards';

// Tabs
export { DetailTabs, useDetailTabs } from './DetailTabs';
export type { DetailTabsProps, TabConfig } from './DetailTabs';

// Lists
export { EntityListCard } from './EntityListCard';
export type { EntityListCardProps, BaseListEntity } from './EntityListCard';

// Charts
export {
  SeverityPieChart,
  transformSeverityBreakdown,
  transformCategoryBreakdown,
} from './SeverityPieChart';
export type { SeverityPieChartProps, PieChartDataPoint } from './SeverityPieChart';

// Error Handling
export { ChartErrorBoundary, withChartErrorBoundary } from './ChartErrorBoundary';
export type { ChartErrorBoundaryProps, ChartErrorInfo } from './ChartErrorBoundary';
