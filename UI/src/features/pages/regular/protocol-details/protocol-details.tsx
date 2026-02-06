import { FC, useMemo, useState } from 'react';
import React from 'react';
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
  Link as MuiLink,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Rating as MuiRating,
} from '@mui/material';
import {
  Business,
  Assessment,
  BugReport,
  TaskAlt,
  Dashboard,
  Timeline as TimelineIcon,
  Grading,
} from '@mui/icons-material';
import { LineChart } from '@mui/x-charts/LineChart';
import { BarChart } from '@mui/x-charts/BarChart';
import { useNavigate } from 'react-router-dom';
import { useProtocolDetails } from './hooks/protocol-details.hook';
import { SeverityColors } from '../../../../contexts/ThemeContext';
import { getCategoryColor, getCategoryLabel } from '../../../../api/soroban-security-portal/models/vulnerability';
import { useAppAuth } from '../../../../features/authentication/useAppAuth';
import { EntityAvatar } from '../../../../components/EntityAvatar';
import { createOrUpdateRatingCall, RatingEntityType } from '../../../../api/soroban-security-portal/soroban-security-portal-api';
import type { Report } from '../../../../api/soroban-security-portal/models/report';
import {
  DetailPageLayout,
  DetailPageHeader,
  StatisticsCards,
  DetailTabs,
  useDetailTabs,
  SeverityPieChart,
  transformSeverityBreakdown,
  transformCategoryBreakdown,
} from '../../../../components/details';
import { formatDateLong } from '../../../../utils';

interface AuditTimelineItem {
  month: string;
  audits: number;
  auditors: number;
}

interface UniqueAuditorItem {
  id: number;
  name: string;
}

export const ProtocolDetails: FC = () => {
  const navigate = useNavigate();
  const theme = useTheme();
  const { canAddReport } = useAppAuth();

  const [ratingDialogOpen, setRatingDialogOpen] = useState(false);
  const [ratingScore, setRatingScore] = useState<number | null>(null);
  const [ratingReview, setRatingReview] = useState('');
  const [ratingSaving, setRatingSaving] = useState(false);

  const {
    protocol,
    company,
    reports,
    statistics,
    ratingSummary,
    recentReviews,
    myRating,
    refreshRatings,
    loading,
    error
  } = useProtocolDetails();

  const { tabValue, tabProps } = useDetailTabs(0);

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

  // Prepare audit timeline data (memoized for performance)
  const auditTimelineData = useMemo<AuditTimelineItem[]>(() => {
    if (reports.length === 0) return [];

    const timelineMap = new Map<string, { month: string; audits: number; auditors: Set<string> }>();

    reports.forEach((report: Report) => {
      const date = new Date(report.date);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const monthLabel = date.toLocaleDateString(undefined, { year: 'numeric', month: 'short' });

      if (!timelineMap.has(monthKey)) {
        timelineMap.set(monthKey, {
          month: monthLabel,
          audits: 0,
          auditors: new Set()
        });
      }

      const entry = timelineMap.get(monthKey)!;
      entry.audits++;
      entry.auditors.add(report.auditorName);
    });

    return Array.from(timelineMap.values())
      .sort((a, b) => a.month.localeCompare(b.month))
      .map(item => ({
        month: item.month,
        audits: item.audits,
        auditors: item.auditors.size
      }));
  }, [reports]);

  const ratingDistribution = useMemo(() => {
    const dist = ratingSummary?.distribution;
    return [1, 2, 3, 4, 5].map(star => ({
      star,
      count: dist ? (dist[star] ?? 0) : 0,
    }));
  }, [ratingSummary?.distribution]);

  const openRatingDialog = () => {
    setRatingScore(myRating?.score ?? null);
    setRatingReview(myRating?.review ?? '');
    setRatingDialogOpen(true);
  };

  const submitRating = async () => {
    if (!protocol) return;
    if (!ratingScore) return;

    try {
      setRatingSaving(true);
      await createOrUpdateRatingCall({
        entityType: RatingEntityType.Protocol,
        entityId: protocol.id,
        score: ratingScore,
        review: ratingReview,
      });
      await refreshRatings(RatingEntityType.Protocol, protocol.id);
      setRatingDialogOpen(false);
    } finally {
      setRatingSaving(false);
    }
  };

  // Get unique auditors for easy access (deduplicate by auditorId)
  const uniqueAuditors = useMemo<UniqueAuditorItem[]>(() => {
    if (reports.length === 0) return [];
    const auditorMap = new Map<number, { id: number; name: string }>();
    reports.forEach((r: Report) => {
      if (!auditorMap.has(r.auditorId)) {
        auditorMap.set(r.auditorId, { id: r.auditorId, name: r.auditorName });
      }
    });
    return Array.from(auditorMap.values());
  }, [reports]);

  // Calculate fix rate
  const fixRate = statistics && statistics.totalVulnerabilities > 0
    ? Math.round((statistics.fixedVulnerabilities / statistics.totalVulnerabilities) * 100)
    : 0;

  // Configure statistics cards
  const statsCards = [
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
      icon: <TaskAlt sx={{ fontSize: 40 }} />,
      iconColor: SeverityColors['low'],
      value: statistics?.fixedVulnerabilities || 0,
      label: 'Fixed',
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
    { id: 'history', label: 'Audit History', icon: <TimelineIcon /> },
  ];

  return (
    <DetailPageLayout
      loading={loading}
      error={error}
      entity={protocol}
      entityName="Protocol"
    >
      {protocol && (
        <>
          {/* Header */}
          <Box sx={{ mb: 3 }}>
            <DetailPageHeader
              entityType="protocol"
              entityId={protocol.id}
              title={protocol.name}
              subtitle={company ? `by ${company.name}` : undefined}
              websiteUrl={protocol.url}
              actions={
                <>
                  {company?.url && (
                    <Button
                      variant="contained"
                      href={company.url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Company Website
                    </Button>
                  )}
                  {canAddReport && (
                    <Button
                      variant="outlined"
                      color="secondary"
                      startIcon={<Assessment />}
                      onClick={() => navigate(`/reports/add?protocol=${encodeURIComponent(protocol.name)}&company=${company ? encodeURIComponent(company.name) : ''}`)}
                    >
                      Add Report
                    </Button>
                  )}
                </>
              }
            />
          </Box>

          {/* Tabs */}
          <DetailTabs tabs={tabs} {...tabProps} />

          {/* Overview Tab Content */}
          {tabValue === 0 && (
            <Box sx={{
              display: 'flex',
              flexDirection: { xs: 'column', lg: 'row' },
              gap: 3
            }}>
              {/* Statistics Cards */}
              <Box sx={{ flex: 1 }}>
                {/* Overview Statistics */}
                <StatisticsCards cards={statsCards} />

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

                  {/* Vulnerability Categories Chart */}
                  <SeverityPieChart
                    data={vulnCategoryData}
                    title="Vulnerabilities by Category"
                    emptyMessage="No vulnerability data available"
                  />

                  {/* Audit Timeline Chart */}
                  <Card>
                    <CardContent>
                      <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                        Audit Timeline
                      </Typography>
                      {auditTimelineData.length > 0 ? (
                        <Box sx={{ height: 300, width: '100%' }}>
                          <LineChart
                            series={[{
                              data: auditTimelineData.map(item => item.audits),
                              label: 'Audit Reports',
                              color: theme.palette.primary.main
                            }]}
                            xAxis={[{
                              data: auditTimelineData.map(item => item.month),
                              scaleType: 'point',
                            }]}
                            height={300}
                          />
                        </Box>
                      ) : (
                        <Box sx={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Typography color="text.secondary">No audit timeline data available</Typography>
                        </Box>
                      )}
                    </CardContent>
                  </Card>
                </Box>
              </Box>

              {/* Sidebar */}
              <Box sx={{ flex: { lg: 0.4 } }}>
                {/* Protocol Information */}
                <Card sx={{ mb: 3 }}>
                  <CardContent>
                    <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                      <Business sx={{ mr: 1, verticalAlign: 'middle' }} />
                      Protocol Information
                    </Typography>

                    <Stack spacing={2}>
                      <Box>
                        <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                          Protocol Name
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {protocol.name}
                        </Typography>
                      </Box>

                      {company && (
                        <Box>
                          <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                            Company
                          </Typography>
                          <Typography
                            variant="body2"
                            sx={{
                              color: 'primary.main',
                              cursor: 'pointer',
                              textDecoration: 'underline',
                              '&:hover': { color: 'primary.dark' }
                            }}
                            onClick={() => navigate(`/company/${company.id}`)}
                          >
                            {company.name}
                          </Typography>
                        </Box>
                      )}

                      <Box>
                        <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                          On Track Since
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {formatDateLong(protocol.date)}
                        </Typography>
                      </Box>

                      {protocol.description && (
                        <Box>
                          <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                            About
                          </Typography>
                          <Typography
                            variant="body2"
                            color="text.secondary"
                            sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}
                          >
                            {protocol.description}
                          </Typography>
                        </Box>
                      )}
                    </Stack>
                  </CardContent>
                </Card>

                {/* Ratings */}
                <Card sx={{ mb: 3 }}>
                  <CardContent>
                    <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                      <Typography variant="h6" sx={{ fontWeight: 600 }}>
                        <Grading sx={{ mr: 1, verticalAlign: 'middle' }} />
                        Ratings
                      </Typography>
                      <Button variant="outlined" size="small" onClick={openRatingDialog}>
                        {myRating ? 'Update rating' : 'Rate'}
                      </Button>
                    </Stack>

                    {ratingSummary ? (
                      <Stack spacing={2}>
                        <Box>
                          <Typography variant="h4" sx={{ fontWeight: 700, lineHeight: 1 }}>
                            {ratingSummary.weightedAverageScore?.toFixed(1) ?? ratingSummary.averageScore.toFixed(1)}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            Average rating ({ratingSummary.totalReviews} total)
                          </Typography>
                        </Box>

                        <Box sx={{ height: 160 }}>
                          <BarChart
                            xAxis={[{ data: ratingDistribution.map((d: { star: number; count: number }) => `${d.star}`), scaleType: 'band' }]}
                            series={[{ data: ratingDistribution.map((d: { star: number; count: number }) => d.count), label: 'Ratings', color: theme.palette.primary.main }]}
                            height={160}
                            margin={{ left: 40, right: 10, top: 10, bottom: 30 }}
                          />
                        </Box>

                        <Box>
                          <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                            Recent reviews
                          </Typography>
                          {recentReviews.length > 0 ? (
                            <List sx={{ px: 0 }}>
                              {recentReviews.slice(0, 5).map((r, idx: number) => (
                                <React.Fragment key={r.id}>
                                  <ListItem sx={{ px: 0, alignItems: 'flex-start' }}>
                                    <ListItemText
                                      primary={
                                        <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={2}>
                                          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                                            {r.author.fullName}
                                            <Typography component="span" variant="caption" color="text.secondary">&nbsp;(rep {r.author.reputationScore})</Typography>
                                          </Typography>
                                          <Typography variant="caption" color="text.secondary">
                                            {formatDateLong(r.createdAt)}
                                          </Typography>
                                        </Stack>
                                      }
                                      secondary={
                                        <Box sx={{ mt: 0.5 }}>
                                          <MuiRating value={r.score} readOnly size="small" />
                                          {r.review && (
                                            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, whiteSpace: 'pre-wrap' }}>
                                              {r.review}
                                            </Typography>
                                          )}
                                        </Box>
                                      }
                                    />
                                  </ListItem>
                                  {idx < Math.min(recentReviews.length, 5) - 1 && <Divider />}
                                </React.Fragment>
                              ))}
                            </List>
                          ) : (
                            <Typography variant="body2" color="text.secondary">
                              No reviews yet
                            </Typography>
                          )}
                        </Box>
                      </Stack>
                    ) : (
                      <Typography variant="body2" color="text.secondary">
                        Ratings unavailable
                      </Typography>
                    )}
                  </CardContent>
                </Card>

                {/* Auditors Overview */}
                <Card sx={{ mb: 3 }}>
                  <CardContent>
                    <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                      Auditors
                    </Typography>
                    {uniqueAuditors.length > 0 ? (
                      <List>
                        {uniqueAuditors.map((auditor, index) => (
                          <React.Fragment key={auditor.id}>
                            <ListItem
                              sx={{
                                px: 0,
                                cursor: 'pointer',
                                '&:hover': { backgroundColor: 'action.hover' },
                                borderRadius: 1
                              }}
                              onClick={() => navigate(`/auditor/${auditor.id}`)}
                            >
                              <ListItemAvatar>
                                <EntityAvatar
                                  entityType="auditor"
                                  entityId={auditor.id}
                                  size="small"
                                  fallbackText={auditor.name}
                                />
                              </ListItemAvatar>
                              <ListItemText
                                primary={auditor.name}
                                secondary={`${reports.filter(r => r.auditorName === auditor.name).length} reports`}
                              />
                            </ListItem>
                            {index < uniqueAuditors.length - 1 && <Divider />}
                          </React.Fragment>
                        ))}
                      </List>
                    ) : (
                      <Typography color="text.secondary">No auditors found</Typography>
                    )}
                  </CardContent>
                </Card>

                {/* Audit Reports */}
                <Card>
                  <CardContent>
                    <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                      <Assessment sx={{ mr: 1, verticalAlign: 'middle' }} />
                      Audit Reports ({reports.length})
                    </Typography>

                    {reports.length > 0 ? (
                      <List sx={{ maxHeight: 400, overflow: 'auto' }}>
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
                                    <React.Fragment>
                                      <Typography component="span" variant="body2" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                                        by&nbsp;
                                        <MuiLink
                                          rel="noopener noreferrer"
                                          sx={{ textDecoration: 'none', flexShrink: 0, width: { xs: '100%', sm: 'auto' } }}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            navigate(`/auditor/${report.auditorId}`);
                                          }}
                                        >
                                          {report.auditorName}
                                        </MuiLink>
                                      </Typography>
                                      <Typography component="span" variant="body2" color="text.secondary" sx={{ display: 'block' }}>
                                        {formatDateLong(report.date)}
                                      </Typography>
                                    </React.Fragment>
                                  }
                                />
                              </ListItem>
                              {index < reports.length - 1 && <Divider />}
                            </Box>
                          ))}
                      </List>
                    ) : (
                      <Typography color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
                        No audit reports available
                      </Typography>
                    )}
                  </CardContent>
                </Card>
              </Box>
            </Box>
          )}

          <Dialog open={ratingDialogOpen} onClose={() => setRatingDialogOpen(false)} maxWidth="sm" fullWidth>
            <DialogTitle>{myRating ? 'Update your rating' : 'Rate this protocol'}</DialogTitle>
            <DialogContent>
              <Stack spacing={2} sx={{ mt: 1 }}>
                <Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                    Stars
                  </Typography>
                  <MuiRating
                    value={ratingScore}
                    onChange={(_: React.SyntheticEvent, value: number | null) => setRatingScore(value)}
                    size="large"
                  />
                </Box>
                <TextField
                  label="Review (optional)"
                  value={ratingReview}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setRatingReview(e.target.value)}
                  multiline
                  minRows={3}
                  inputProps={{ maxLength: 2000 }}
                  fullWidth
                />
              </Stack>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setRatingDialogOpen(false)} disabled={ratingSaving}>Cancel</Button>
              <Button onClick={submitRating} variant="contained" disabled={ratingSaving || !ratingScore}>
                {ratingSaving ? 'Saving…' : 'Save'}
              </Button>
            </DialogActions>
          </Dialog>

          {/* Audit History Tab Content */}
          {tabValue === 1 && (
            <Box>
              {reports && reports.length > 0 ? (
                <List sx={{ width: '100%' }}>
                  {reports.map((report) => (
                    <React.Fragment key={report.id}>
                      <ListItem
                        sx={{
                          px: 0,
                          '&:hover': {
                            backgroundColor: 'rgba(0, 0, 0, 0.04)',
                            borderRadius: 1
                          },
                          cursor: 'pointer'
                        }}
                        onClick={() => navigate(`/report/${report.id}`)}
                      >
                        <ListItemAvatar>
                          <EntityAvatar
                            entityType="report"
                            entityId={report.id}
                            size={48}
                            fallbackText={report.name}
                          />
                        </ListItemAvatar>
                        <ListItemText
                          primary={
                            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                              Report #{report.id}
                            </Typography>
                          }
                          secondary={
                            <React.Fragment>
                              <Typography component="span" sx={{ display: 'block', mb: 0.5, color: 'text.secondary' }}>
                                Created: {formatDateLong(report.date)}
                              </Typography>
                              <Typography component="span" sx={{ display: 'block', color: 'text.secondary' }}>
                                Status: {report.status}
                              </Typography>
                            </React.Fragment>
                          }
                        />
                      </ListItem>
                      <Divider />
                    </React.Fragment>
                  ))}
                </List>
              ) : (
                <Typography color="text.secondary" sx={{ textAlign: 'center', py: 8 }}>
                  No audit reports available for this protocol
                </Typography>
              )}
            </Box>
          )}
        </>
      )}
    </DetailPageLayout>
  );
};