import { ReactNode } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Tooltip,
} from '@mui/material';

/**
 * Configuration for a single statistic card
 */
export interface StatisticCard {
  /** Icon to display */
  icon: ReactNode;
  /** Icon color (hex or theme color) */
  iconColor: string;
  /** The numeric or string value to display */
  value: number | string;
  /** Label describing the metric */
  label: string;
  /** Optional tooltip explaining the metric */
  tooltip?: string;
}

/**
 * Props for StatisticsCards component
 */
export interface StatisticsCardsProps {
  /** Array of statistic card configurations */
  cards: StatisticCard[];
  /** Grid column configuration */
  columns?: {
    xs?: number;
    sm?: number;
    md?: number;
    lg?: number;
  };
}

/**
 * StatisticsCards - A grid of statistics cards for detail pages.
 *
 * Provides consistent layout for displaying key metrics like:
 * - Total Reports
 * - Protocols Audited
 * - Vulnerabilities Found
 * - Fix Rate
 *
 * @example Basic usage:
 * ```tsx
 * <StatisticsCards
 *   cards={[
 *     {
 *       icon: <Assessment sx={{ fontSize: 40 }} />,
 *       iconColor: SeverityColors.note,
 *       value: statistics?.totalReports || 0,
 *       label: 'Audit Reports'
 *     },
 *     {
 *       icon: <Business sx={{ fontSize: 40 }} />,
 *       iconColor: SeverityColors.note,
 *       value: statistics?.protocolsAudited || 0,
 *       label: 'Protocols Audited'
 *     },
 *     {
 *       icon: <BugReport sx={{ fontSize: 40 }} />,
 *       iconColor: SeverityColors.medium,
 *       value: statistics?.totalVulnerabilities || 0,
 *       label: 'Vulnerabilities'
 *     },
 *     {
 *       icon: <Grading sx={{ fontSize: 40 }} />,
 *       iconColor: SeverityColors.note,
 *       value: `${fixRate}%`,
 *       label: 'Fix Rate',
 *       tooltip: 'Percentage of valid vulnerabilities that have been fixed'
 *     }
 *   ]}
 * />
 * ```
 *
 * @example With custom columns:
 * ```tsx
 * <StatisticsCards
 *   cards={cards}
 *   columns={{ xs: 1, sm: 2, md: 3 }}
 * />
 * ```
 */
export function StatisticsCards({
  cards,
  columns = { xs: 2, md: 4 },
}: StatisticsCardsProps) {
  const gridTemplateColumns = {
    xs: `repeat(${columns.xs || 2}, 1fr)`,
    sm: columns.sm ? `repeat(${columns.sm}, 1fr)` : undefined,
    md: `repeat(${columns.md || 4}, 1fr)`,
    lg: columns.lg ? `repeat(${columns.lg}, 1fr)` : undefined,
  };

  // Filter out undefined values
  const cleanGridTemplateColumns = Object.fromEntries(
    Object.entries(gridTemplateColumns).filter(([, v]) => v !== undefined)
  );

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: cleanGridTemplateColumns,
        gap: 2,
        mb: 3,
      }}
    >
      {cards.map((card, index) => (
        <StatisticCardItem key={index} card={card} />
      ))}
    </Box>
  );
}

/**
 * Internal component for rendering a single statistic card
 */
function StatisticCardItem({ card }: { card: StatisticCard }) {
  const content = (
    <Card sx={{ textAlign: 'center' }}>
      <CardContent>
        <Box sx={{ color: card.iconColor, mb: 1 }}>
          {card.icon}
        </Box>
        <Typography variant="h4" sx={{ fontWeight: 600, mb: 0.5 }}>
          {card.value}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {card.label}
        </Typography>
      </CardContent>
    </Card>
  );

  if (card.tooltip) {
    return (
      <Tooltip title={card.tooltip} arrow>
        {content}
      </Tooltip>
    );
  }

  return content;
}
