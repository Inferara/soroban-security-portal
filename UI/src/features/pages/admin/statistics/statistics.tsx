import { FC } from 'react';
import { Box, Paper, Typography, CircularProgress, Table, TableBody, TableCell, TableHead, TableRow, Link } from '@mui/material';
import VisibilityIcon from '@mui/icons-material/Visibility';
import PeopleIcon from '@mui/icons-material/People';
import ShareIcon from '@mui/icons-material/Share';
import { LineChart } from '@mui/x-charts/LineChart';
import { useStatistics } from './hooks/useStatistics';
import { StatisticsCards } from '../../../../components/details';
import { SeverityColors } from '../../../../contexts/ThemeContext';
import { PageViewEntityType } from '../../../../api/soroban-security-portal/models/analytics';

// Detail-page routes are all singular per the public router (main-window.tsx):
// /report/:id, /auditor/:id, /vulnerability/:id, /protocol/:id.
const typePath: Record<PageViewEntityType, string> = {
  [PageViewEntityType.Report]: 'report',
  [PageViewEntityType.Auditor]: 'auditor',
  [PageViewEntityType.Vulnerability]: 'vulnerability',
  [PageViewEntityType.Protocol]: 'protocol',
};
const typeLabel: Record<PageViewEntityType, string> = {
  [PageViewEntityType.Report]: 'Report',
  [PageViewEntityType.Auditor]: 'Auditor',
  [PageViewEntityType.Vulnerability]: 'Vulnerability',
  [PageViewEntityType.Protocol]: 'Protocol',
};

export const Statistics: FC = () => {
  const { stats, loading, error } = useStatistics();

  if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress /></Box>;
  if (error) return <Typography color="error" sx={{ p: 2 }}>{error}</Typography>;
  if (!stats) return null;

  const cards = [
    { icon: <VisibilityIcon sx={{ fontSize: 40 }} />, iconColor: SeverityColors['note'], value: stats.totalHumanViews, label: 'Total Views' },
    { icon: <PeopleIcon sx={{ fontSize: 40 }} />, iconColor: SeverityColors['low'], value: stats.uniqueVisitors, label: 'Unique Visitors' },
    { icon: <ShareIcon sx={{ fontSize: 40 }} />, iconColor: SeverityColors['medium'], value: stats.crawlerShares, label: 'Link-Preview Shares', tooltip: 'Times a link to this site was unfurled by a social/crawler bot' },
  ];

  const xLabels = stats.daily.map((d) => d.date.substring(5, 10)); // MM-DD
  const series = stats.daily.map((d) => d.views);

  return (
    <Box sx={{ p: { xs: 1, md: 2 } }}>
      <StatisticsCards cards={cards} columns={{ xs: 12, sm: 4, md: 4 }} />

      <Paper sx={{ p: 2, mt: 3 }}>
        <Typography variant="h6" sx={{ mb: 1 }}>Views over the last 30 days</Typography>
        {series.length > 0 ? (
          <LineChart height={280} xAxis={[{ scaleType: 'point', data: xLabels }]} series={[{ data: series, label: 'Human views', color: SeverityColors['note'] }]} />
        ) : (
          <Typography color="text.secondary">No views recorded yet.</Typography>
        )}
      </Paper>

      <Paper sx={{ p: 2, mt: 3 }}>
        <Typography variant="h6" sx={{ mb: 1 }}>Most viewed content</Typography>
        <Table size="small">
          <TableHead>
            <TableRow><TableCell>Type</TableCell><TableCell>Title</TableCell><TableCell align="right">Views</TableCell></TableRow>
          </TableHead>
          <TableBody>
            {stats.topEntities.map((e) => (
              <TableRow key={`${e.entityType}-${e.entityId}`}>
                <TableCell>{typeLabel[e.entityType]}</TableCell>
                <TableCell><Link href={`/${typePath[e.entityType]}/${e.entityId}`} target="_blank" rel="noopener">{e.title}</Link></TableCell>
                <TableCell align="right">{e.views}</TableCell>
              </TableRow>
            ))}
            {stats.topEntities.length === 0 && (
              <TableRow><TableCell colSpan={3}>No data yet.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Paper>
    </Box>
  );
};
