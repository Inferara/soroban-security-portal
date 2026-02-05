import { FC, useEffect, useMemo } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  CircularProgress,
  Stack,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Divider,
  Chip,
  ListItemButton,
} from '@mui/material';
import {
  OpenInNew,
  Business,
  Assessment,
  Grading,
  BugReport,
  CheckCircle,
  Error as ErrorIcon,
  Person,
  GetApp,
  Description,
  Dashboard,
} from '@mui/icons-material';
import FullscreenIcon from '@mui/icons-material/Fullscreen';
import { useNavigate } from 'react-router-dom';
import { useReportDetails } from './hooks/report-details.hook';
import { showMessage } from '../../../dialog-handler/dialog-handler';
import ReactGA from 'react-ga4';
import { SeverityColors } from '../../../../contexts/ThemeContext';
import {
  getCategoryColor,
  getCategoryLabel,
  VulnerabilityCategory,
} from '../../../../api/soroban-security-portal/models/vulnerability';
import { BookmarkButton } from '../../../../components/BookmarkButton';
import { BookmarkType } from '../../../../api/soroban-security-portal/models/bookmark';
import { useBookmarks } from '../../../../contexts/BookmarkContext';
import { downloadReportPDF } from '../../../../api/soroban-security-portal/soroban-security-portal-api';
import { useAppAuth } from '../../../authentication/useAppAuth';
import { isAuthorized, canEdit } from '../../../authentication/authPermissions';
import { EntityAvatar } from '../../../../components/EntityAvatar';
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
import { getSeverityColor } from '../../../../utils/color-utils';
import { CommentSection } from '../../../../components/comments/comment-section';
import { ReferenceType } from '../../../../api/soroban-security-portal/models/comment';


export const ReportDetails: FC = () => {
  const navigate = useNavigate();
  const { auth } = useAppAuth();

  const {
    report,
    protocol,
    auditor,
    company,
    vulnerabilities,
    statistics,
    loading,
    error,
    // PDF handling from hook
    pdfBlobUrl,
    pdfLoading,
    pdfLoadError,
    fetchPdfForViewing,
    retryPdfLoad,
  } = useReportDetails();

  const { tabValue, tabProps } = useDetailTabs(0);
  const { isBookmarked, toggleBookmark } = useBookmarks();

  // Calculate fix metrics (memoized)
  const { fixedValidVulns, notFixedValidVulns, fixRate } = useMemo(() => {
    const fixed = statistics?.vulnerabilitiesByCategory?.[VulnerabilityCategory.Valid] || 0;
    const notFixed = Object.entries(statistics?.vulnerabilitiesByCategory || {})
      .filter((c) => Number(c[0]) !== VulnerabilityCategory.Valid)
      .reduce((sum, [, count]) => sum + count, 0);
    const rate = statistics && statistics.totalVulnerabilities > 0
      ? Math.round((fixed / (fixed + notFixed)) * 100)
      : 0;
    return { fixedValidVulns: fixed, notFixedValidVulns: notFixed, fixRate: rate };
  }, [statistics]);

  // Prepare chart data (memoized)
  const severityChartData = useMemo(
    () => transformSeverityBreakdown(statistics?.severityBreakdown),
    [statistics?.severityBreakdown]
  );

  const vulnCategoryData = useMemo(
    () =>
      transformCategoryBreakdown(
        statistics?.vulnerabilitiesByCategory,
        getCategoryLabel,
        getCategoryColor
      ),
    [statistics?.vulnerabilitiesByCategory]
  );

  // Sort vulnerabilities by severity (memoized)
  const sortedVulnerabilities = useMemo(() => {
    const severityOrder: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1, note: 0 };
    return [...vulnerabilities].sort((a, b) => {
      const aSeverity = severityOrder[a.severity?.toLowerCase()] || 0;
      const bSeverity = severityOrder[b.severity?.toLowerCase()] || 0;
      return bSeverity - aSeverity;
    });
  }, [vulnerabilities]);

  const handleReportDownload = async (reportName: string, reportId: number) => {
    if (!isAuthorized(auth)) {
      showMessage('Log in to download the report');
      ReactGA.event({
        category: 'Report',
        action: 'download',
        label: `Unauthorized attempt to download the report ${reportId}`,
      });
      return;
    }
    try {
      await downloadReportPDF(reportName, reportId);
      ReactGA.event({
        category: 'Report',
        action: 'download',
        label: `Downloaded report ${reportId}`,
      });
    } catch (err) {
      showMessage(err instanceof Error ? err.message : 'Failed to download report');
      ReactGA.event({
        category: 'Report',
        action: 'download_error',
        label: `Failed to download report ${reportId}`,
      });
    }
  };

  // Fetch PDF when tab changes to Full Report or when report/auth changes
  useEffect(() => {
    if (tabValue === 1 && report && isAuthorized(auth) && !pdfBlobUrl && !pdfLoading) {
      fetchPdfForViewing();
    }
  }, [tabValue, report, auth.user?.access_token, pdfBlobUrl, pdfLoading, fetchPdfForViewing]);

  // Configure statistics cards
  const statsCards = [
    {
      icon: <BugReport sx={{ fontSize: 40 }} />,
      iconColor: SeverityColors['medium'],
      value: statistics?.totalVulnerabilities || 0,
      label: 'Total Vulnerabilities',
    },
    {
      icon: <CheckCircle sx={{ fontSize: 40 }} />,
      iconColor: SeverityColors['low'],
      value: fixedValidVulns,
      label: 'Fixed',
    },
    {
      icon: <ErrorIcon sx={{ fontSize: 40 }} />,
      iconColor: SeverityColors['critical'],
      value: notFixedValidVulns,
      label: 'Not Fixed',
    },
    {
      icon: <Grading sx={{ fontSize: 40 }} />,
      iconColor: SeverityColors['note'],
      value: `${fixRate}%`,
      label: 'Fixed Rate',
      tooltip: 'Percentage of vulnerabilities that have been fixed',
    },
  ];

  // Configure tabs
  const tabs = [
    { id: 'overview', label: 'Overview', icon: <Dashboard /> },
    { id: 'full-report', label: 'Full Report', icon: <Description /> },
  ];

  return (
    <DetailPageLayout
      loading={loading}
      error={error}
      entity={report}
      entityName="Report"
    >
      {report && (
        <>
          {/* Header */}
          <Box sx={{ mb: 3 }}>
            <DetailPageHeader
              entityType="report"
              entityId={report.id}
              title={report.name}
              subtitle={auditor ? `by ${auditor.name}` : undefined}
              description={`Published: ${formatDateLong(report.date)}`}
              actions={
                <>
                  <Button
                    variant="contained"
                    startIcon={<GetApp />}
                    onClick={() => handleReportDownload(report.name, report.id)}
                  >
                    Download PDF
                  </Button>
                  {canEdit(auth) && (
                    <Button
                      variant="contained"
                      startIcon={<BugReport />}
                      onClick={() =>
                        navigate(
                          `/vulnerabilities/add?report=${encodeURIComponent(report.name)}&protocol=${protocol ? encodeURIComponent(protocol.name) : ''}&auditor=${auditor ? encodeURIComponent(auditor.name) : ''}`
                        )
                      }
                    >
                      Add Vulnerability
                    </Button>
                  )}
                </>
              }
              headerExtra={
                auth.isAuthenticated && (
                  <BookmarkButton
                    itemId={report.id ?? 0}
                    bookmarkType={BookmarkType.Report}
                    isBookmarked={isBookmarked(report.id ?? 0, BookmarkType.Report)}
                    onToggle={toggleBookmark}
                  />
                )
              }
            />
          </Box>

          {/* Tabs */}
          <DetailTabs tabs={tabs} {...tabProps} />

          {/* Overview Tab Content */}
          {tabValue === 0 && (
            <Box
              sx={{
                display: 'flex',
                flexDirection: { xs: 'column', lg: 'row' },
                gap: 3,
              }}
            >
              {/* Statistics and Charts */}
              <Box sx={{ flex: 1 }}>
                {/* Overview Statistics */}
                <StatisticsCards cards={statsCards} />

                {/* Charts */}
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' },
                    gap: 3,
                    mb: 3,
                  }}
                >
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

                {/* Vulnerabilities List */}
                <Card sx={{ mb: 3 }}>
                  <CardContent>
                    <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                      <BugReport sx={{ mr: 1, verticalAlign: 'middle' }} />
                      Vulnerabilities ({vulnerabilities.length})
                    </Typography>

                    {sortedVulnerabilities.length > 0 ? (
                      <List sx={{ maxHeight: 400, overflow: 'auto' }}>
                        {sortedVulnerabilities.map((vulnerability, index) => (
                          <Box key={vulnerability.id}>
                            <ListItem disablePadding>
                              <ListItemButton
                                sx={{ px: 1, borderRadius: 1 }}
                                onClick={() => navigate(`/vulnerability/${vulnerability.id}`)}
                              >
                                <ListItemAvatar>
                                  <Box>
                                    {vulnerability.category === VulnerabilityCategory.Valid ? (
                                      <img
                                        loading="lazy"
                                        src="/static/images/vulnerability_categories/valid-fixed.png"
                                        alt="Valid"
                                        width={40}
                                        height={40}
                                        title="Valid (Fixed)"
                                      />
                                    ) : vulnerability.category === VulnerabilityCategory.ValidNotFixed ? (
                                      <img
                                        loading="lazy"
                                        src="/static/images/vulnerability_categories/valid-not-fixed.png"
                                        alt="Valid Not Fixed"
                                        width={40}
                                        height={40}
                                        title="Valid (Not Fixed)"
                                      />
                                    ) : vulnerability.category === VulnerabilityCategory.ValidPartiallyFixed ? (
                                      <img
                                        loading="lazy"
                                        src="/static/images/vulnerability_categories/valid-partially-fixed.png"
                                        alt="Valid Partially Fixed"
                                        width={40}
                                        height={40}
                                        title="Valid (Partially Fixed)"
                                      />
                                    ) : (
                                      <BugReport />
                                    )}
                                  </Box>
                                </ListItemAvatar>
                                <ListItemText
                                  primary={
                                    <Box
                                      sx={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 1,
                                        flexWrap: 'wrap',
                                      }}
                                    >
                                      <Typography
                                        variant="subtitle2"
                                        sx={{ fontWeight: 600, wordBreak: 'break-word' }}
                                      >
                                        {vulnerability.title}
                                      </Typography>
                                      <Chip
                                        label={vulnerability.severity}
                                        size="small"
                                        sx={{
                                          backgroundColor: getSeverityColor(vulnerability.severity),
                                          color: '#fff',
                                          fontWeight: 600,
                                        }}
                                      />
                                    </Box>
                                  }
                                  secondary={
                                    <Typography
                                      component="span"
                                      variant="body2"
                                      color="text.secondary"
                                      sx={{
                                        mt: 0.5,
                                        display: '-webkit-box',
                                        WebkitLineClamp: 2,
                                        WebkitBoxOrient: 'vertical',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                      }}
                                    >
                                      {vulnerability.description?.replace(/[#*`]/g, '').substring(0, 150)}
                                      {vulnerability.description && vulnerability.description.length > 150
                                        ? '...'
                                        : ''}
                                    </Typography>
                                  }
                                />
                              </ListItemButton>
                            </ListItem>
                            {index < sortedVulnerabilities.length - 1 && <Divider />}
                          </Box>
                        ))}
                      </List>
                    ) : (
                      <Typography color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
                        No vulnerabilities found in this report
                      </Typography>
                    )}
                  </CardContent>
                </Card>

                {/* Comments Section */}
                <CommentSection referenceId={report.id} referenceType={ReferenceType.Report} />
              </Box>

              {/* Sidebar - Report Info */}
              <Box sx={{ flex: { lg: 0.4 } }}>
                {/* Report Information */}
                <Card sx={{ mb: 3 }}>
                  <CardContent>
                    <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                      <Assessment sx={{ mr: 1, verticalAlign: 'middle' }} />
                      Report Information
                    </Typography>

                    <Stack spacing={2}>
                      <Box>
                        <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                          Report Name
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {report.name}
                        </Typography>
                      </Box>

                      <Box>
                        <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                          Publication Date
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {formatDateLong(report.date)}
                        </Typography>
                      </Box>
                    </Stack>
                  </CardContent>
                </Card>

                {/* Auditor Information */}
                {auditor && (
                  <Card sx={{ mb: 3 }}>
                    <CardContent>
                      <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                        <Person sx={{ mr: 1, verticalAlign: 'middle' }} />
                        Auditor
                      </Typography>

                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                        <EntityAvatar
                          entityType="auditor"
                          entityId={auditor.id}
                          size="medium"
                          fallbackText={auditor.name}
                          sx={{ mr: 2 }}
                        />
                        <Box sx={{ flexGrow: 1 }}>
                          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                            {auditor.name}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            Security Auditor
                          </Typography>
                        </Box>
                      </Box>

                      {auditor.description && (
                        <Typography
                          variant="body2"
                          color="text.secondary"
                          sx={{
                            mb: 2,
                            whiteSpace: 'pre-wrap',
                            lineHeight: 1.6,
                            display: '-webkit-box',
                            WebkitLineClamp: 3,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {auditor.description}
                        </Typography>
                      )}

                      <Stack spacing={1}>
                        <Button
                          variant="contained"
                          size="small"
                          startIcon={<FullscreenIcon />}
                          onClick={() => navigate(`/auditor/${auditor.id}`)}
                          fullWidth
                        >
                          View Auditor Profile
                        </Button>

                        {auditor.url && (
                          <Button
                            variant="contained"
                            size="small"
                            startIcon={<OpenInNew />}
                            href={auditor.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            fullWidth
                          >
                            Visit Auditor Website
                          </Button>
                        )}
                      </Stack>
                    </CardContent>
                  </Card>
                )}

                {/* Protocol Information */}
                {protocol && (
                  <Card>
                    <CardContent>
                      <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                        <Business sx={{ mr: 1, verticalAlign: 'middle' }} />
                        Protocol
                      </Typography>

                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                        <EntityAvatar
                          entityType="protocol"
                          entityId={protocol.id}
                          size="medium"
                          fallbackText={protocol.name}
                          sx={{ mr: 2 }}
                        />
                        <Box sx={{ flexGrow: 1 }}>
                          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                            {protocol.name}
                          </Typography>
                          {company && (
                            <Typography variant="body2" color="text.secondary">
                              by{' '}
                              <Typography
                                component="span"
                                variant="body2"
                                sx={{
                                  color: 'primary.main',
                                  cursor: 'pointer',
                                  textDecoration: 'underline',
                                  '&:hover': { color: 'primary.dark' },
                                }}
                                onClick={() => navigate(`/company/${company.id}`)}
                              >
                                {company.name}
                              </Typography>
                            </Typography>
                          )}
                        </Box>
                      </Box>

                      {protocol.description && (
                        <Typography
                          variant="body2"
                          color="text.secondary"
                          sx={{
                            mb: 2,
                            whiteSpace: 'pre-wrap',
                            lineHeight: 1.6,
                            display: '-webkit-box',
                            WebkitLineClamp: 3,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {protocol.description}
                        </Typography>
                      )}

                      <Stack spacing={1}>
                        <Button
                          variant="contained"
                          size="small"
                          startIcon={<FullscreenIcon />}
                          onClick={() => navigate(`/protocol/${protocol.id}`)}
                          fullWidth
                        >
                          View Protocol Details
                        </Button>

                        {protocol.url && (
                          <Button
                            variant="contained"
                            size="small"
                            startIcon={<OpenInNew />}
                            href={protocol.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            fullWidth
                          >
                            Visit Protocol Website
                          </Button>
                        )}
                      </Stack>
                    </CardContent>
                  </Card>
                )}
              </Box>
            </Box>
          )}

          {/* Second Tab - Full Report */}
          {tabValue === 1 && (
            <Box>
              <Card>
                <CardContent sx={{ p: 0 }}>
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      p: 2,
                      borderBottom: 1,
                      borderColor: 'divider',
                    }}
                  >
                    <Typography variant="h6" sx={{ fontWeight: 600 }}>
                      Full Report (PDF)
                    </Typography>
                    {isAuthorized(auth) && (
                      <Button
                        variant="outlined"
                        size="small"
                        startIcon={<GetApp />}
                        onClick={() => handleReportDownload(report.name, report.id)}
                      >
                        Download
                      </Button>
                    )}
                  </Box>

                  {isAuthorized(auth) ? (
                    <Box sx={{ height: '80vh', width: '100%' }}>
                      {pdfLoading ? (
                        <Box
                          sx={{
                            p: 4,
                            textAlign: 'center',
                            height: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <Box>
                            <CircularProgress size={60} sx={{ mb: 2 }} />
                            <Typography variant="h6" color="text.secondary">
                              Loading PDF...
                            </Typography>
                          </Box>
                        </Box>
                      ) : pdfLoadError ? (
                        <Box
                          sx={{
                            p: 4,
                            textAlign: 'center',
                            height: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <Box>
                            <Typography variant="h6" color="text.secondary" sx={{ mb: 2 }}>
                              Unable to Load PDF Preview
                            </Typography>
                            <Typography color="text.secondary" sx={{ mb: 3 }}>
                              The PDF viewer encountered an authentication error. You can still download the report.
                            </Typography>
                            <Stack direction="row" spacing={2} justifyContent="center">
                              <Button
                                variant="contained"
                                color="primary"
                                startIcon={<GetApp />}
                                onClick={() => handleReportDownload(report.name, report.id)}
                              >
                                Download Report
                              </Button>
                              <Button variant="outlined" onClick={retryPdfLoad}>
                                Retry
                              </Button>
                            </Stack>
                          </Box>
                        </Box>
                      ) : pdfBlobUrl ? (
                        <iframe
                          src={`${pdfBlobUrl}#toolbar=1&navpanes=1&scrollbar=1`}
                          width="100%"
                          height="100%"
                          style={{
                            border: 'none',
                            borderRadius: 0,
                          }}
                          title="Report PDF Viewer"
                        />
                      ) : (
                        <Box
                          sx={{
                            p: 4,
                            textAlign: 'center',
                            height: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <Typography variant="h6" color="text.secondary">
                            Click on the &quot;Full Report (PDF)&quot; tab to load the document
                          </Typography>
                        </Box>
                      )}
                    </Box>
                  ) : (
                    <Box sx={{ p: 4, textAlign: 'center' }}>
                      <Typography variant="h6" color="text.secondary" sx={{ mb: 2 }}>
                        Authentication Required
                      </Typography>
                      <Typography color="text.secondary" sx={{ mb: 3 }}>
                        Please log in to view the full report
                      </Typography>
                      <Button
                        variant="contained"
                        color="primary"
                        onClick={() => showMessage('Log in to view the full report')}
                      >
                        Log In
                      </Button>
                    </Box>
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
