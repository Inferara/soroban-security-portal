import { FC, useMemo, useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Stack,
  useTheme,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Divider,
} from '@mui/material';
import {
  Business,
  BugReport,
  Assessment,
  Grading,
  Person,
  Timeline as TimelineIcon,
  Dashboard,
  Star,
} from '@mui/icons-material';
import { Rating } from '@mui/material';
import { LineChart } from '@mui/x-charts/LineChart';
import { useNavigate } from 'react-router-dom';
import { useAuditorDetails } from './hooks/auditor-details.hook';
import { SeverityColors } from '../../../../contexts/ThemeContext';
import { useAppAuth } from '../../../../features/authentication/useAppAuth';
import { getCategoryColor, getCategoryLabel, VulnerabilityCategory } from '../../../../api/soroban-security-portal/models/vulnerability';
import { EntityAvatar } from '../../../../components/EntityAvatar';
import {
  DetailPageLayout,
  DetailPageHeader,
  StatisticsCards,
  DetailTabs,
  useDetailTabs,
  EntityListCard,
  SeverityPieChart,
  transformSeverityBreakdown,
  transformCategoryBreakdown,
} from '../../../../components/details';
import { formatDateLong, formatMonthYear } from '../../../../utils';
import { AuditorRatingSection } from './components/AuditorRatingSection';
import { AddRatingDialog } from './components/AddRatingDialog';

export const AuditorDetails: FC = () => {
  const navigate = useNavigate();
  const theme = useTheme();
  const { canAddReport } = useAppAuth();

  const {
    auditor,
    reports,
    protocols,
    statistics,
    ratings,
    averageRating,
    handleAddRating,
    loading,
    error
  } = useAuditorDetails();

  const [ratingDialogOpen, setRatingDialogOpen] = useState(false);
  const isAuthenticated = !!useAppAuth().auth; // Simple check for now

  const { tabValue, tabProps } = useDetailTabs(0);

  // Calculate fix rate
  const fixedValidVulns = statistics?.vulnerabilitiesByCategory![VulnerabilityCategory.Valid] || 0;
  const notFixedValidVulns = Object.entries(statistics?.vulnerabilitiesByCategory || {})
    .filter(c => Number(c[0]) !== VulnerabilityCategory.Valid)
    .reduce((sum, [, count]) => sum + count, 0);
  const fixRate = statistics && statistics.totalVulnerabilities > 0
    ? Math.round((fixedValidVulns / (fixedValidVulns + notFixedValidVulns)) * 100)
    : 0;

  // Prepare chart data using utility functions (memoized for performance)
  const severityChartData = useMemo(
    () => transformSeverityBreakdown(statistics?.severityBreakdown),
    [statistics?.severityBreakdown]
  );
  const vulnCategoryData = useMemo(
    () => transformCategoryBreakdown(
      statistics?.vulnerabilitiesByCategory,
      getCategoryLabel,
      getCategoryColor
    ),
    [statistics?.vulnerabilitiesByCategory]
  );

  // Get unique protocols audited by this auditor (memoized)
  const auditedProtocols = useMemo(
    () => protocols.filter(protocol =>
      reports.some(report => report.protocolId === protocol.id)
    ),
    [protocols, reports]
  );

  // Configure statistics cards
  const statsCards = [
    {
      icon: <Assessment sx={{ fontSize: 40 }} />,
      iconColor: SeverityColors['note'],
      value: statistics?.totalReports || 0,
      label: 'Audit Reports',
    },
    {
      icon: <Business sx={{ fontSize: 40 }} />,
      iconColor: SeverityColors['note'],
      value: statistics?.protocolsAudited || 0,
      label: 'Protocols Audited',
    },
    {
      icon: <BugReport sx={{ fontSize: 40 }} />,
      iconColor: SeverityColors['medium'],
      value: statistics?.totalVulnerabilities || 0,
      label: 'Vulnerabilities Reported',
    },
    {
      icon: <Grading sx={{ fontSize: 40 }} />,
      iconColor: SeverityColors['note'],
      value: `${fixRate}%`,
      label: 'Fix Rate',
      tooltip: 'Percentage of valid vulnerabilities that have been fixed',
    },
  ];

  // Configure tabs
  const tabs = [
    { id: 'overview', label: 'Overview', icon: <Dashboard /> },
    { id: 'activity', label: 'Activity', icon: <TimelineIcon /> },
  ];

  return (
    <DetailPageLayout
      loading={loading}
      error={error}
      entity={auditor}
      entityName="Auditor"
    >
      {auditor && (
        <>
          {/* Header */}
          <DetailPageHeader
            entityType="auditor"
            entityId={auditor.id}
            title={auditor.name}
            subtitle="Security Auditor"
            description={`Since ${formatDateLong(auditor.date)}`}
            websiteUrl={auditor.url}
            actions={
              <>
                {canAddReport && (
                  <Button
                    variant="outlined"
                    color="secondary"
                    startIcon={<Assessment />}
                    onClick={() => navigate(`/reports/add?auditor=${encodeURIComponent(auditor.name)}`)}
                  >
                    Add Report
                  </Button>
                )}
                <Button
                  variant="contained"
                  color="primary"
                  startIcon={<Star />}
                  onClick={() => setRatingDialogOpen(true)}
                  disabled={!isAuthenticated}
                >
                  Rate Auditor
                </Button>
              </>
            }
            headerExtra={
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <Rating value={averageRating} precision={0.5} readOnly size="medium" />
                <Typography variant="body2" color="text.secondary" sx={{ ml: 1 }}>
                  ({averageRating.toFixed(1)})
                </Typography>
              </Box>
            }
          />

          <AddRatingDialog
            open={ratingDialogOpen}
            onClose={() => setRatingDialogOpen(false)}
            onSubmit={handleAddRating}
            auditorName={auditor.name}
          />

          {/* Tabs */}
          <DetailTabs tabs={tabs} {...tabProps} />

          {/* Overview Tab Content */}
          {tabValue === 0 && (
            <Box sx={{
              display: 'flex',
              flexDirection: { xs: 'column', lg: 'row' },
              gap: 3
            }}>
              {/* Statistics and Charts */}
              <Box sx={{ flex: 1 }}>
                {/* Overview Statistics */}
                <StatisticsCards cards={statsCards} />

                {/* Rating Section */}
                <AuditorRatingSection
                  ratings={ratings}
                  averageRating={averageRating}
                  onAddRating={() => setRatingDialogOpen(true)}
                  canRate={isAuthenticated}
                />

                {/* Charts */}
                <Box sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' },
                  gap: 3,
                  mb: 3
                }}>
                  {/* Severity Breakdown Chart */}
                  <SeverityPieChart
                    data={severityChartData}
                    title="Vulnerabilities by Severity"
                    emptyMessage="No vulnerability data available"
                  />

                  {/* Fix Status Chart */}
                  <SeverityPieChart
                    data={vulnCategoryData}
                    title="Fix Status"
                    emptyMessage="No vulnerability data available"
                  />
                </Box>

                {/* Reports Timeline */}
                {statistics?.reportsTimeline && statistics.reportsTimeline.length > 0 && (
                  <Card sx={{ mb: 3 }}>
                    <CardContent>
                      <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                        <TimelineIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                        Reports Timeline
                      </Typography>
                      <Box sx={{ height: 300, width: '100%' }}>
                        <LineChart
                          series={[{
                            data: statistics.reportsTimeline.map(item => item.count),
                            label: 'Reports Published',
                            color: theme.palette.primary.main
                          }]}
                          xAxis={[{
                            data: statistics.reportsTimeline.map(item => formatMonthYear(item.month)),
                            scaleType: 'point',
                          }]}
                          height={300}
                        />
                      </Box>
                    </CardContent>
                  </Card>
                )}
              </Box>

              {/* Sidebar */}
              <Box sx={{ flex: { lg: 0.4 } }}>
                {/* Auditor Information */}
                <Card sx={{ mb: 3 }}>
                  <CardContent>
                    <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                      <Person sx={{ mr: 1, verticalAlign: 'middle' }} />
                      Auditor Information
                    </Typography>

                    <Stack spacing={2}>
                      <Box>
                        <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                          Name
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {auditor.name}
                        </Typography>
                      </Box>

                      <Box>
                        <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                          On Track Since
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {formatDateLong(auditor.date)}
                        </Typography>
                      </Box>

                      {auditor.description && (
                        <Box>
                          <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                            About
                          </Typography>
                          <Typography
                            variant="body2"
                            color="text.secondary"
                            sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}
                          >
                            {auditor.description}
                          </Typography>
                        </Box>
                      )}
                    </Stack>
                  </CardContent>
                </Card>

                {/* Protocols Audited - Using EntityListCard */}
                <EntityListCard
                  title="Protocols Audited"
                  headerIcon={<Business sx={{ mr: 1, verticalAlign: 'middle' }} />}
                  count={auditedProtocols.length}
                  items={auditedProtocols}
                  entityType="protocol"
                  navigationPattern="/protocol/{id}"
                  emptyMessage="No protocols audited"
                  maxHeight={300}
                  renderSecondary={(protocol) => (
                    <Typography component="span" variant="body2" color="text.secondary">
                      {reports.filter(r => r.protocolId === protocol.id).length} reports
                    </Typography>
                  )}
                />

                {/* Recent Reports - Using EntityListCard */}
                <EntityListCard
                  title="Recent Reports"
                  headerIcon={<Assessment sx={{ mr: 1, verticalAlign: 'middle' }} />}
                  count={reports.length}
                  items={reports}
                  entityType="report"
                  navigationPattern="/report/{id}"
                  emptyMessage="No reports available"
                  maxItems={10}
                  maxHeight={400}
                  sortFn={(a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()}
                  renderSecondary={(report) => (
                    <>
                      <Typography variant="body2" color="text.secondary" component="span" sx={{ display: 'block' }}>
                        {report.protocolName}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" component="span" sx={{ display: 'block' }}>
                        {formatDateLong(report.date)}
                      </Typography>
                    </>
                  )}
                />
              </Box>
            </Box>
          )}

          {/* Activity Tab Content */}
          {tabValue === 1 && (
            <Box>
              <Card>
                <CardContent>
                  <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                    <TimelineIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                    Audit Activity Timeline
                  </Typography>
                  {reports.length > 0 ? (
                    <List sx={{ maxHeight: 600, overflow: 'auto' }}>
                      {reports
                        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                        .map((report, index) => (
                          <Box key={report.id}>
                            <ListItem
                              sx={{
                                px: 0,
                                cursor: 'pointer',
                                '&:hover': { backgroundColor: 'action.hover' },
                                borderRadius: 1
                              }}
                              onClick={() => navigate(`/report/${report.id}`)}
                            >
                              <ListItemAvatar>
                                <EntityAvatar
                                  entityType="report"
                                  entityId={report.id}
                                  size="small"
                                  fallbackText={report.name}
                                />
                              </ListItemAvatar>
                              <ListItemText
                                primary={
                                  <Typography
                                    variant="subtitle2"
                                    sx={{ fontWeight: 600, wordBreak: 'break-word' }}
                                  >
                                    {report.name}
                                  </Typography>
                                }
                                secondary={
                                  <Typography component="span" variant="body2" color="text.secondary">
                                    Published: {formatDateLong(report.date)}
                                  </Typography>
                                }
                              />
                            </ListItem>
                            {index < reports.length - 1 && <Divider />}
                          </Box>
                        ))}
                    </List>
                  ) : (
                    <Typography color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
                      No audit reports found
                    </Typography>
                  )}
                </CardContent>
              </Card>
            </Box>
          )}
        </>
      )}
    </DetailPageLayout>
  );
};
