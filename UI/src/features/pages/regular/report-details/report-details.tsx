import { FC, useState } from 'react';
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
import { environment } from '../../../../environments/environment';
import { AuthContextProps, useAuth } from 'react-oidc-context';
import { isAuthorized, Role } from '../../../../api/soroban-security-portal/models/role';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeRaw from 'rehype-raw';
import { showMessage } from '../../../dialog-handler/dialog-handler';
import ReactGA from 'react-ga4';

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
    error
  } = useReportDetails();

  const [tabValue, setTabValue] = useState(0);

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const canDownloadReport = (auth: AuthContextProps) => isAuthorized(auth);

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

  const getSeverityColor = (severity: string) => {
    switch (severity?.toLowerCase()) {
      case 'critical': return '#c72e2b';
      case 'high': return '#FF6B3D';
      case 'medium': return '#FFD84D';
      case 'low': return '#569E67';
      case 'note': return '#72F1FF';
      default: return theme.palette.grey[400];
    }
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

  const fixStatusData = statistics ? [
    { label: 'Fixed', value: statistics.fixedVulnerabilities, color: '#4CAF50' },
    { label: 'Active', value: statistics.activeVulnerabilities, color: '#FF6B3D' }
  ] : [];

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
        </Box>

        <Stack direction="row" spacing={2} sx={{ mb: 2, flexWrap: 'wrap', gap: 1 }}>
          <Button
            variant="contained"
            startIcon={<GetApp />}
            onClick={() => handleReportDownload(report.id)}
          >
            Download PDF
          </Button>
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
                <BugReport sx={{ fontSize: 40, color: 'warning.main', mb: 1 }} />
                <Typography variant="h4" sx={{ fontWeight: 600, mb: 0.5 }}>
                  {statistics?.totalVulnerabilities || 0}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Total Issues
                </Typography>
              </CardContent>
            </Card>

            <Card sx={{ textAlign: 'center' }}>
              <CardContent>
                <CheckCircle sx={{ fontSize: 40, color: 'success.main', mb: 1 }} />
                <Typography variant="h4" sx={{ fontWeight: 600, mb: 0.5 }}>
                  {statistics?.fixedVulnerabilities || 0}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Fixed
                </Typography>
              </CardContent>
            </Card>

            <Card sx={{ textAlign: 'center' }}>
              <CardContent>
                <ErrorIcon sx={{ fontSize: 40, color: 'error.main', mb: 1 }} />
                <Typography variant="h4" sx={{ fontWeight: 600, mb: 0.5 }}>
                  {statistics?.activeVulnerabilities || 0}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Active
                </Typography>
              </CardContent>
            </Card>

            <Card sx={{ textAlign: 'center' }}>
              <CardContent>
                <Assessment sx={{ fontSize: 40, color: 'info.main', mb: 1 }} />
                <Typography variant="h4" sx={{ fontWeight: 600, mb: 0.5 }}>
                  {statistics && statistics.totalVulnerabilities > 0 
                    ? Math.round((statistics.fixedVulnerabilities / statistics.totalVulnerabilities) * 100)
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
                {fixStatusData.length > 0 && fixStatusData.some(d => d.value > 0) ? (
                  <Box sx={{ height: 300, display: 'flex', justifyContent: 'center' }}>
                    <PieChart
                      series={[{
                        data: fixStatusData,
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
                Vulnerabilities Found ({vulnerabilities.length})
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
                          <Avatar sx={{ 
                            bgcolor: getSeverityColor(vulnerability.severity),
                            color: '#fff'
                          }}>
                            <BugReport />
                          </Avatar>
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
                              {vulnerability.status && (
                                <Chip 
                                  label={vulnerability.status}
                                  size="small"
                                  color={vulnerability.status.toLowerCase() === 'fixed' ? 'success' : 'default'}
                                  variant="outlined"
                                />
                              )}
                            </Box>
                          }
                          secondary={
                            <Typography 
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

                {report.status && (
                  <Box>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                      Status
                    </Typography>
                    <Chip
                      label={report.status}
                      size="small"
                      color={report.status.toLowerCase() === 'approved' ? 'success' : 'default'}
                      variant="outlined"
                    />
                  </Box>
                )}

                {report.author && (
                  <Box>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                      Author
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {report.author}
                    </Typography>
                  </Box>
                )}

                {report.lastActionBy && (
                  <Box>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                      Last Updated
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      By {report.lastActionBy}
                      {report.lastActionAt && ` on ${formatDate(report.lastActionAt)}`}
                    </Typography>
                  </Box>
                )}
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
                    variant="outlined"
                    size="small"
                    startIcon={<OpenInNew />}
                    onClick={() => navigate(`/auditor/${auditor.id}`)}
                    fullWidth
                  >
                    View Auditor Profile
                  </Button>
                  
                  {auditor.url && (
                    <Button
                      variant="text"
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
                        by {company.name}
                      </Typography>
                    )}
                  </Box>
                </Box>

                <Stack spacing={1}>
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<OpenInNew />}
                    onClick={() => navigate(`/protocol/${protocol.id}`)}
                    fullWidth
                  >
                    View Protocol Details
                  </Button>
                  
                  {protocol.url && (
                    <Button
                      variant="text"
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
          {report.mdFile ? (
            <Card>
              <CardContent>
                <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                  Full Report Content
                </Typography>
                <Box sx={{
                  '& pre': { 
                    backgroundColor: theme.palette.mode === 'dark' ? '#2d2d2d' : '#f5f5f5',
                    padding: 2,
                    borderRadius: 1,
                    overflow: 'auto'
                  },
                  '& code': { 
                    backgroundColor: theme.palette.mode === 'dark' ? '#2d2d2d' : '#f5f5f5',
                    padding: '2px 4px',
                    borderRadius: 1,
                    fontSize: '0.875rem'
                  },
                  '& blockquote': {
                    borderLeft: '4px solid',
                    borderColor: 'primary.main',
                    paddingLeft: 2,
                    marginLeft: 0,
                    fontStyle: 'italic'
                  }
                }}>
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm, remarkMath]}
                    rehypePlugins={[rehypeRaw, rehypeKatex]}
                  >
                    {report.mdFile}
                  </ReactMarkdown>
                </Box>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent>
                <Typography color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
                  No report content available
                </Typography>
              </CardContent>
            </Card>
          )}
        </Box>
      )}
    </Box>
  );
};