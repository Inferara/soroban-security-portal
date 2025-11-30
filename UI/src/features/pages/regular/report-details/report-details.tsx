import { FC, useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  CircularProgress,
  Alert,
  Stack,
  useMediaQuery,
  useTheme,
  Avatar,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Divider,
  Chip,
  Tabs,
  Tab
} from '@mui/material';
import { 
  ArrowBack, 
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
  Dashboard
} from '@mui/icons-material';
import { PieChart } from '@mui/x-charts/PieChart';
import { useNavigate } from 'react-router-dom';
import { useReportDetails } from './hooks/report-details.hook';
import FullscreenIcon from '@mui/icons-material/Fullscreen';
import { environment } from '../../../../environments/environment';
import { AuthContextProps, useAuth } from 'react-oidc-context';
import { isAuthorized, Role } from '../../../../api/soroban-security-portal/models/role';
import { showMessage } from '../../../dialog-handler/dialog-handler';
import ReactGA from 'react-ga4';
import { SeverityColors } from '../../../../contexts/ThemeContext';
import { getCategoryColor, getCategoryLabel, VulnerabilityCategory } from '../../../../api/soroban-security-portal/models/vulnerability';
import { BookmarkButton } from '../../../../components/BookmarkButton';
import { BookmarkType } from '../../../../api/soroban-security-portal/models/bookmark';
import { useBookmarks } from '../../../../contexts/BookmarkContext';

export const ReportDetails: FC = () => {
  const navigate = useNavigate();
  const theme = useTheme();
  const auth = useAuth();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  
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
    retryPdfLoad
  } = useReportDetails();

  const [tabValue, setTabValue] = useState(0);
  const { isBookmarked, toggleBookmark } = useBookmarks();

  const fixedValidVulns = statistics?.vulnerabilitiesByCategory![VulnerabilityCategory.Valid] || 0;
  const notFixedValidVulns = Object.entries(statistics?.vulnerabilitiesByCategory || {}).filter(c => Number(c[0]) !== VulnerabilityCategory.Valid).reduce((sum, [, count]) => sum + count, 0);

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const canDownloadReport = (auth: AuthContextProps) => isAuthorized(auth);
  
  const canAddVulnerability = (auth: AuthContextProps) => 
    auth.user?.profile.role === Role.Admin || auth.user?.profile.role === Role.Contributor || auth.user?.profile.role === Role.Moderator;

  const handleReportDownload = (reportId: number) => {
    if (!canDownloadReport(auth)) {
      showMessage("Log in to download the report");
      ReactGA.event({ category: "Report", action: "download", label: `Unauthorized attempt to download the report ${reportId}` });
      return;
    }
    const link = document.createElement('a');
    link.href = `${environment.apiUrl}/api/v1/reports/${reportId}/download?token=${auth.user?.access_token}`;
    link.setAttribute('download', '');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    ReactGA.event({ category: "Report", action: "view", label: `Downloaded report ${reportId}` });
  };

  // Fetch PDF when tab changes to Full Report or when report/auth changes
  useEffect(() => {
    if (tabValue === 1 && report && canDownloadReport(auth) && !pdfBlobUrl && !pdfLoading) {
      fetchPdfForViewing();
    }
  }, [tabValue, report, auth.user?.access_token, pdfBlobUrl, pdfLoading]);

  const getSeverityColor = (severity: string) => {
    const s = severity?.toLowerCase();
    if (s in SeverityColors) {
      return SeverityColors[s];
    }
    return theme.palette.grey[400];
  };

  const formatDate = (dateString: Date | string) => {
    try {
      return new Date(dateString).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch {
      return 'Unknown date';
    }
  };

  if (loading) {
    return (
      <Box
        sx={{ 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center', 
          minHeight: '50vh' 
        }}
      >
        <CircularProgress size={60} />
      </Box>
    );
  }

  if (error || !report) {
    return (
      <Box sx={{ p: 3 }}>
        <Button
          startIcon={<ArrowBack />}
          onClick={() => navigate(-1)}
          sx={{ mb: 2 }}
        >
          Back
        </Button>
        <Alert severity="error">
          {error || 'Report not found'}
        </Alert>
      </Box>
    );
  }

  // Prepare chart data
  const severityChartData = statistics ? Object.entries(statistics.severityBreakdown).map(([severity, count]) => ({
    id: severity,
    value: count,
    label: severity.charAt(0).toUpperCase() + severity.slice(1),
    color: getSeverityColor(severity)
  })) : [];

  const vulnCategoryData = statistics ? Object.entries(statistics.vulnerabilitiesByCategory || {}).map(([categoryId, count]) => ({
    id: Number(categoryId),
    value: count,
    label: getCategoryLabel(Number(categoryId)),
    color: getCategoryColor(Number(categoryId))
  })) : [];

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: '1400px', mx: 'auto' }}>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Button
          variant="contained"
          startIcon={<ArrowBack />}
          onClick={() => navigate(-1)}
          sx={{ mb: 2 }}
        >
          Back
        </Button>

        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <Avatar sx={{ width: 60, height: 60, mr: 2, bgcolor: 'secondary.main' }}>
            <Assessment />
          </Avatar>
          <Box sx={{ flexGrow: 1 }}>
            <Typography 
              variant={isMobile ? "h5" : "h4"} 
              sx={{ fontWeight: 600, mb: 0.5, wordBreak: 'break-word' }}
            >
              {report.name}
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Published: {formatDate(report.date)}
            </Typography>
            {auditor && (
              <Typography variant="body2" color="text.secondary">
                by {auditor.name}
              </Typography>
            )}
          </Box>
          <BookmarkButton
            itemId={report.id ?? 0}
            bookmarkType={BookmarkType.Report}
            isBookmarked={isBookmarked(report.id ?? 0, BookmarkType.Report)}
            onToggle={toggleBookmark}
          />
        </Box>

        <Stack direction="row" spacing={2} sx={{ mb: 2, flexWrap: 'wrap', gap: 1 }}>
          <Button
            variant="contained"
            startIcon={<GetApp />}
            onClick={() => handleReportDownload(report.id)}
          >
            Download PDF
          </Button>
          {canAddVulnerability(auth) && (
            <Button
              variant="contained"
              startIcon={<BugReport />}
              onClick={() => navigate(`/vulnerabilities/add?report=${encodeURIComponent(report.name)}&protocol=${protocol ? encodeURIComponent(protocol.name) : ''}&auditor=${auditor ? encodeURIComponent(auditor.name) : ''}`)}
            >
              Add Vulnerability
            </Button>
          )}
        </Stack>
      </Box>

      {/* Tabs */}
      <Box sx={{ mb: 3, borderBottom: 1, borderColor: 'divider' }}>
        <Tabs 
          value={tabValue} 
          onChange={handleTabChange}
          variant={isMobile ? "fullWidth" : "standard"}
          sx={{
            '& .MuiTab-root': {
              textTransform: 'none',
              fontSize: '1rem',
              fontWeight: 600,
              minHeight: 64
            }
          }}
        >
          <Tab 
            icon={<Dashboard />} 
            iconPosition="start" 
            label="Overview" 
          />
          <Tab 
            icon={<Description />} 
            iconPosition="start"
            label="Full Report" 
          />
        </Tabs>
      </Box>

      {/* Tab Content */}
      {tabValue === 0 && (
        <Box sx={{ 
          display: 'flex', 
          flexDirection: { xs: 'column', lg: 'row' },
          gap: 3
        }}>
          {/* Statistics and Charts */}
          <Box sx={{ flex: 1 }}>
          {/* Overview Statistics */}
          <Box sx={{ 
            display: 'grid',
            gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' },
            gap: 2,
            mb: 3
          }}>
            <Card sx={{ textAlign: 'center' }}>
              <CardContent>
                <BugReport sx={{ fontSize: 40, color: SeverityColors['medium'], mb: 1 }} />
                <Typography variant="h4" sx={{ fontWeight: 600, mb: 0.5 }}>
                  {statistics?.totalVulnerabilities || 0}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Total Vulnerabilities
                </Typography>
              </CardContent>
            </Card>

            <Card sx={{ textAlign: 'center' }}>
              <CardContent>
                <CheckCircle sx={{ fontSize: 40, color: SeverityColors["low"], mb: 1 }} />
                <Typography variant="h4" sx={{ fontWeight: 600, mb: 0.5 }}>
                  {statistics?.vulnerabilitiesByCategory![VulnerabilityCategory.Valid] || 0}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Fixed
                </Typography>
              </CardContent>
            </Card>

            <Card sx={{ textAlign: 'center' }}>
              <CardContent>
                <ErrorIcon sx={{ fontSize: 40, color: SeverityColors["critical"], mb: 1 }} />
                <Typography variant="h4" sx={{ fontWeight: 600, mb: 0.5 }}>
                  {statistics ? Object.entries(statistics.vulnerabilitiesByCategory || {})
                    .filter(c => Number(c[0]) !== VulnerabilityCategory.Valid)
                    .reduce((sum, [, count]) => sum + count, 0) : 0}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Not Fixed
                </Typography>
              </CardContent>
            </Card>

            <Card sx={{ textAlign: 'center' }}>
              <CardContent>
                <Grading sx={{ fontSize: 40, color: SeverityColors["note"], mb: 1 }} />
                <Typography variant="h4" sx={{ fontWeight: 600, mb: 0.5 }}>
                  {statistics && statistics.totalVulnerabilities > 0 
                    ? Math.round((fixedValidVulns / (fixedValidVulns + notFixedValidVulns)) * 100)
                    : 0}%
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Fixed Rate
                </Typography>
              </CardContent>
            </Card>
          </Box>

          {/* Charts */}
          <Box sx={{ 
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' },
            gap: 3,
            mb: 3
          }}>
            {/* Severity Breakdown Chart */}
            <Card>
              <CardContent>
                <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                  Vulnerabilities by Severity
                </Typography>
                {severityChartData.length > 0 ? (
                  <Box sx={{ height: 300, display: 'flex', justifyContent: 'center' }}>
                    <PieChart
                      series={[{
                        data: severityChartData,
                        highlightScope: { fade: 'global', highlight: 'item' },
                      }]}
                      width={isMobile ? 280 : 350}
                      height={300}
                    />
                  </Box>
                ) : (
                  <Box sx={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Typography color="text.secondary">No vulnerability data available</Typography>
                  </Box>
                )}
              </CardContent>
            </Card>

            {/* Fix Status Chart */}
            <Card>
              <CardContent>
                <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                  Fix Status
                </Typography>
                {vulnCategoryData.length > 0 && vulnCategoryData.some(d => d.value > 0) ? (
                  <Box sx={{ height: 300, display: 'flex', justifyContent: 'center' }}>
                    <PieChart
                      series={[{
                        data: vulnCategoryData,
                        highlightScope: { fade: 'global', highlight: 'item' },
                      }]}
                      width={isMobile ? 280 : 350}
                      height={300}
                    />
                  </Box>
                ) : (
                  <Box sx={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Typography color="text.secondary">No vulnerability data available</Typography>
                  </Box>
                )}
              </CardContent>
            </Card>
          </Box>

          {/* Vulnerabilities List */}
          <Card>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                <BugReport sx={{ mr: 1, verticalAlign: 'middle' }} />
                Vulnerabilities ({vulnerabilities.length})
              </Typography>
              
              {vulnerabilities.length > 0 ? (
                <List sx={{ maxHeight: 400, overflow: 'auto' }}>
                  {vulnerabilities
                    .sort((a, b) => {
                      const severityOrder = { critical: 4, high: 3, medium: 2, low: 1, note: 0 };
                      const aSeverity = severityOrder[a.severity?.toLowerCase() as keyof typeof severityOrder] || 0;
                      const bSeverity = severityOrder[b.severity?.toLowerCase() as keyof typeof severityOrder] || 0;
                      return bSeverity - aSeverity;
                    })
                    .map((vulnerability, index) => (
                    <Box key={vulnerability.id}>
                      <ListItem 
                        sx={{ 
                          px: 0,
                          cursor: 'pointer',
                          '&:hover': { backgroundColor: 'action.hover' },
                          borderRadius: 1
                        }}
                        onClick={() => navigate(`/vulnerability/${vulnerability.id}`)}
                      >
                        <ListItemAvatar>
                          <Box sx={{ 
                            // bgcolor: getSeverityColor(vulnerability.severity),
                            // color: '#fff'
                          }}>
                            {vulnerability.category === VulnerabilityCategory.Valid ? (
                              <img
                                loading="lazy"
                                src="/static/images/vulnerability_categories/valid-fixed.png"
                                alt="Valid" width={40} height={40}
                                title="Valid (Fixed)"/>
                            ) : vulnerability.category === VulnerabilityCategory.ValidNotFixed ? (
                              <img 
                                loading="lazy"
                                src="/static/images/vulnerability_categories/valid-not-fixed.png"
                                alt="Valid Not Fixed" width={40} height={40}
                                title="Valid (Not Fixed)"/>
                            ) : vulnerability.category === VulnerabilityCategory.ValidPartiallyFixed ? (
                              <img
                                loading="lazy"
                                src="/static/images/vulnerability_categories/valid-partially-fixed.png"
                                alt="Valid Partially Fixed" width={40} height={40}
                                title="Valid (Partially Fixed)"/>
                            ) : <BugReport />}
                          </Box>
                        </ListItemAvatar>
                        <ListItemText
                          primary={
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
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
                                  fontWeight: 600
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
                                textOverflow: 'ellipsis'
                              }}
                            >
                              {vulnerability.description?.replace(/[#*`]/g, '').substring(0, 150)}
                              {vulnerability.description && vulnerability.description.length > 150 ? '...' : ''}
                            </Typography>
                          }
                        />
                      </ListItem>
                      {index < vulnerabilities.length - 1 && <Divider />}
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
                    {formatDate(report.date)}
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
                  <Avatar sx={{ width: 40, height: 40, mr: 2, bgcolor: 'info.main' }}>
                    <Person />
                  </Avatar>
                  <Box sx={{ flexGrow: 1 }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                      {auditor.name}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Security Auditor
                    </Typography>
                  </Box>
                </Box>

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
                  <Avatar sx={{ width: 40, height: 40, mr: 2, bgcolor: 'primary.main' }}>
                    <Business />
                  </Avatar>
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
                            '&:hover': { color: 'primary.dark' }
                          }}
                          onClick={() => navigate(`/company/${company.id}`)}
                        >
                          {company.name}
                        </Typography>
                      </Typography>
                    )}
                  </Box>
                </Box>

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
              <Box sx={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'space-between', 
                p: 2, 
                borderBottom: 1, 
                borderColor: 'divider' 
              }}>
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                  Full Report (PDF)
                </Typography>
                {canDownloadReport(auth) && (
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<GetApp />}
                    onClick={() => handleReportDownload(report.id)}
                  >
                    Download
                  </Button>
                )}
              </Box>
              
              {canDownloadReport(auth) ? (
                <Box sx={{ height: '80vh', width: '100%' }}>
                  {pdfLoading ? (
                    <Box sx={{ p: 4, textAlign: 'center', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Box>
                        <CircularProgress size={60} sx={{ mb: 2 }} />
                        <Typography variant="h6" color="text.secondary">
                          Loading PDF...
                        </Typography>
                      </Box>
                    </Box>
                  ) : pdfLoadError ? (
                    <Box sx={{ p: 4, textAlign: 'center', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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
                            onClick={() => handleReportDownload(report.id)}
                          >
                            Download Report
                          </Button>
                          <Button
                            variant="outlined"
                            onClick={retryPdfLoad}
                          >
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
                        borderRadius: 0
                      }}
                      title="Report PDF Viewer"
                    />
                  ) : (
                    <Box sx={{ p: 4, textAlign: 'center', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Typography variant="h6" color="text.secondary">
                        Click on the "Full Report (PDF)" tab to load the document
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
                    onClick={() => showMessage("Log in to view the full report")}
                  >
                    Log In
                  </Button>
                </Box>
              )}
            </CardContent>
          </Card>
        </Box>
      )}
    </Box>
  );
};