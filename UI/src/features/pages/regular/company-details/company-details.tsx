import { FC, useMemo } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Stack,
  Avatar,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Divider,
  ListItemButton,
} from '@mui/material';
import {
  Business,
  Assessment,
  BugReport,
  Dashboard,
  Timeline as TimelineIcon,
  Grading,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useCompanyDetails } from './hooks/company-details.hook';
import { SeverityColors } from '../../../../contexts/ThemeContext';
import { getCategoryColor, getCategoryLabel } from '../../../../api/soroban-security-portal/models/vulnerability';
import {
  DetailPageLayout,
  DetailPageHeader,
  StatisticsCards,
  DetailTabs,
  useDetailTabs,
  EntityListCard,
  SeverityPieChart,
  transformCategoryBreakdown,
} from '../../../../components/details';
import { formatDateLong } from '../../../../utils';
import { getSeverityColor } from '../../../../utils/color-utils';

export const CompanyDetails: FC = () => {
  const navigate = useNavigate();

  const {
    company,
    protocols,
    reports,
    vulnerabilities,
    statistics,
    loading,
    error,
  } = useCompanyDetails();

  const { tabValue, tabProps } = useDetailTabs(0);

  // Calculate fix rate
  const fixRate = useMemo(() => {
    if (!statistics || statistics.totalVulnerabilities === 0) return 0;
    return Math.round(
      (statistics.fixedVulnerabilities / statistics.totalVulnerabilities) * 100
    );
  }, [statistics]);

  // Prepare chart data (memoized)
  const categoryChartData = useMemo(
    () =>
      transformCategoryBreakdown(
        statistics?.vulnerabilitiesByCategory,
        getCategoryLabel,
        getCategoryColor
      ),
    [statistics?.vulnerabilitiesByCategory]
  );

  // Configure statistics cards
  const statsCards = [
    {
      icon: <Business sx={{ fontSize: 40 }} />,
      iconColor: SeverityColors['note'],
      value: statistics?.totalProtocols || 0,
      label: 'Protocols',
    },
    {
      icon: <Assessment sx={{ fontSize: 40 }} />,
      iconColor: SeverityColors['note'],
      value: statistics?.totalReports || 0,
      label: 'Audit Reports',
    },
    {
      icon: <BugReport sx={{ fontSize: 40 }} />,
      iconColor: SeverityColors['medium'],
      value: statistics?.totalVulnerabilities || 0,
      label: 'Vulnerabilities',
    },
    {
      icon: <Grading sx={{ fontSize: 40 }} />,
      iconColor: SeverityColors['note'],
      value: `${fixRate}%`,
      label: 'Fix Rate',
      tooltip: 'Percentage of vulnerabilities that have been fixed',
    },
  ];

  // Configure tabs
  const tabs = [
    { id: 'overview', label: 'Overview', icon: <Dashboard /> },
    { id: 'analytics', label: 'Analytics', icon: <TimelineIcon /> },
  ];

  return (
    <DetailPageLayout
      loading={loading}
      error={error}
      entity={company}
      entityName="Company"
    >
      {company && (
        <>
          {/* Header */}
          <DetailPageHeader
            entityType="company"
            entityId={company.id}
            title={company.name}
            description={`On Track Since ${formatDateLong(company.date)}`}
            websiteUrl={company.url}
          />

          {/* Statistics Cards */}
          <StatisticsCards cards={statsCards} />

          {/* Tabs */}
          <DetailTabs tabs={tabs} {...tabProps} />

          {/* Overview Tab Content */}
          {tabValue === 0 && (
            <Box
              sx={{
                display: 'flex',
                flexDirection: { xs: 'column', md: 'row' },
                gap: 3,
              }}
            >
              {/* Main Content */}
              <Box sx={{ flex: 1 }}>
                {/* Company Information */}
                <Card sx={{ mb: 3 }}>
                  <CardContent>
                    <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                      <Business sx={{ mr: 1, verticalAlign: 'middle' }} />
                      Company Information
                    </Typography>

                    <Box sx={{ mb: 3 }}>
                      {company.description ? (
                        <Typography
                          variant="body1"
                          sx={{ mb: 2, lineHeight: 1.7, whiteSpace: 'pre-wrap' }}
                        >
                          {company.description}
                        </Typography>
                      ) : (
                        <Typography variant="body1" sx={{ mb: 2, lineHeight: 1.7 }}>
                          <strong>{company.name}</strong> is a blockchain company with{' '}
                          {statistics?.totalProtocols || 0} protocols under security
                          audit. They have completed {statistics?.totalReports || 0} audit
                          reports and identified {statistics?.totalVulnerabilities || 0}{' '}
                          vulnerabilities across their ecosystem.
                        </Typography>
                      )}
                    </Box>
                  </CardContent>
                </Card>

                {/* Protocols - Using EntityListCard */}
                <EntityListCard
                  title="Protocols"
                  headerIcon={<Business sx={{ mr: 1, verticalAlign: 'middle' }} />}
                  count={protocols.length}
                  items={protocols}
                  entityType="protocol"
                  navigationPattern="/protocol/{id}"
                  emptyMessage="No protocols found for this company"
                  maxItems={10}
                  maxHeight={400}
                  avatarSize="medium"
                />
              </Box>

              {/* Sidebar */}
              <Box sx={{ width: { xs: '100%', md: '350px' }, flexShrink: 0 }}>
                {/* Recent Reports - Using EntityListCard */}
                <EntityListCard
                  title="Recent Reports"
                  headerIcon={<Assessment sx={{ mr: 1, verticalAlign: 'middle' }} />}
                  items={reports}
                  entityType="report"
                  navigationPattern="/report/{id}"
                  emptyMessage="No reports available"
                  maxItems={5}
                  maxHeight={300}
                  sortFn={(a, b) =>
                    new Date(b.date).getTime() - new Date(a.date).getTime()
                  }
                  renderSecondary={(report) => (
                    <Typography component="span" variant="caption" color="text.secondary">
                      {formatDateLong(report.date)}
                    </Typography>
                  )}
                />

                {/* Recent Vulnerabilities - Custom rendering for severity colors */}
                <Card sx={{ mb: 3 }}>
                  <CardContent>
                    <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                      <BugReport sx={{ mr: 1, verticalAlign: 'middle' }} />
                      Recent Vulnerabilities
                    </Typography>

                    {vulnerabilities.length > 0 ? (
                      <List sx={{ maxHeight: 300, overflow: 'auto' }}>
                        {vulnerabilities.slice(0, 5).map((vulnerability, index) => (
                          <Box key={vulnerability.id}>
                            <ListItem disablePadding>
                              <ListItemButton
                                sx={{ px: 1, borderRadius: 1 }}
                                onClick={() => navigate(`/vulnerability/${vulnerability.id}`)}
                              >
                                <ListItemAvatar>
                                  <Avatar
                                    sx={{
                                      width: 32,
                                      height: 32,
                                      mr: 1,
                                      bgcolor: getSeverityColor(vulnerability.severity),
                                    }}
                                  >
                                    <BugReport fontSize="small" />
                                  </Avatar>
                                </ListItemAvatar>
                                <ListItemText
                                  primary={
                                    <Typography
                                      component="span"
                                      variant="body2"
                                      sx={{ fontWeight: 500 }}
                                    >
                                      {vulnerability.title}
                                    </Typography>
                                  }
                                  secondary={
                                    <Typography
                                      component="span"
                                      variant="caption"
                                      color="text.secondary"
                                    >
                                      {vulnerability.severity} • {formatDateLong(vulnerability.date)}
                                    </Typography>
                                  }
                                />
                              </ListItemButton>
                            </ListItem>
                            {index < Math.min(vulnerabilities.length, 5) - 1 && <Divider />}
                          </Box>
                        ))}
                      </List>
                    ) : (
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{ textAlign: 'center', py: 2 }}
                      >
                        No vulnerabilities found
                      </Typography>
                    )}
                  </CardContent>
                </Card>
              </Box>
            </Box>
          )}

          {/* Analytics Tab Content */}
          {tabValue === 1 && (
            <Box
              sx={{
                display: 'flex',
                flexDirection: { xs: 'column', lg: 'row' },
                gap: 3,
              }}
            >
              {/* Vulnerability Categories Chart */}
              <Box sx={{ flex: 1 }}>
                <SeverityPieChart
                  data={categoryChartData}
                  title="Vulnerability Categories"
                  emptyMessage="No vulnerability data available"
                  titleIcon={<Grading sx={{ mr: 1, verticalAlign: 'middle' }} />}
                  height={400}
                />
              </Box>

              {/* Severity Breakdown */}
              <Card sx={{ flex: 1 }}>
                <CardContent>
                  <Typography variant="h6" sx={{ mb: 3, fontWeight: 600 }}>
                    <Assessment sx={{ mr: 1, verticalAlign: 'middle' }} />
                    Severity Breakdown
                  </Typography>

                  {statistics?.severityBreakdown &&
                  Object.keys(statistics.severityBreakdown).length > 0 ? (
                    <Stack spacing={2}>
                      {Object.entries(statistics.severityBreakdown).map(
                        ([severity, count]) => (
                          <Box
                            key={severity}
                            sx={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                            }}
                          >
                            <Box sx={{ display: 'flex', alignItems: 'center' }}>
                              <Box
                                sx={{
                                  width: 12,
                                  height: 12,
                                  borderRadius: '50%',
                                  bgcolor: getSeverityColor(severity),
                                  mr: 2,
                                }}
                              />
                              <Typography variant="body1" sx={{ textTransform: 'capitalize' }}>
                                {severity}
                              </Typography>
                            </Box>
                            <Typography variant="h6" sx={{ fontWeight: 600 }}>
                              {count}
                            </Typography>
                          </Box>
                        )
                      )}
                    </Stack>
                  ) : (
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ textAlign: 'center', py: 4 }}
                    >
                      No severity data available
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
