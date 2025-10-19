import { FC } from 'react';
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
  Divider
} from '@mui/material';
import { 
  ArrowBack, 
  OpenInNew, 
  Business, 
  Assessment, 
  BugReport,
  CheckCircle,
  Person,
  Timeline as TimelineIcon
} from '@mui/icons-material';
import { PieChart } from '@mui/x-charts/PieChart';
import { LineChart } from '@mui/x-charts/LineChart';
import { useNavigate } from 'react-router-dom';
import { useAuditorDetails } from './hooks/auditor-details.hook';

export const AuditorDetails: FC = () => {
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  
  const {
    auditor,
    reports,
    protocols,
    statistics,
    loading,
    error
  } = useAuditorDetails();

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

  const formatMonthYear = (monthKey: string) => {
    const [year, month] = monthKey.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1);
    return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short' });
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

  if (error || !auditor) {
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
          {error || 'Auditor not found'}
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

  // Get unique protocols audited by this auditor
  const auditedProtocols = protocols.filter(protocol => 
    reports.some(report => report.protocolId === protocol.id)
  );

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: '1400px', mx: 'auto' }}>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Button
          startIcon={<ArrowBack />}
          onClick={() => navigate(-1)}
          sx={{ mb: 2 }}
        >
          Back
        </Button>
        
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <Avatar sx={{ width: 60, height: 60, mr: 2, bgcolor: 'info.main' }}>
            <Person />
          </Avatar>
          <Box sx={{ flexGrow: 1 }}>
            <Typography 
              variant={isMobile ? "h5" : "h4"} 
              sx={{ fontWeight: 600, mb: 0.5 }}
            >
              {auditor.name}
            </Typography>
            <Typography variant="h6" color="text.secondary">
              Security Auditor
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Since {formatDate(auditor.date)}
            </Typography>
          </Box>
        </Box>

        <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
          {auditor.url && (
            <Button
              variant="outlined"
              startIcon={<OpenInNew />}
              href={auditor.url}
              target="_blank"
              rel="noopener noreferrer"
            >
              Visit Website
            </Button>
          )}
        </Stack>
      </Box>

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
                <Assessment sx={{ fontSize: 40, color: 'primary.main', mb: 1 }} />
                <Typography variant="h4" sx={{ fontWeight: 600, mb: 0.5 }}>
                  {statistics?.totalReports || 0}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Audit Reports
                </Typography>
              </CardContent>
            </Card>

            <Card sx={{ textAlign: 'center' }}>
              <CardContent>
                <Business sx={{ fontSize: 40, color: 'secondary.main', mb: 1 }} />
                <Typography variant="h4" sx={{ fontWeight: 600, mb: 0.5 }}>
                  {statistics?.protocolsAudited || 0}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Protocols Audited
                </Typography>
              </CardContent>
            </Card>

            <Card sx={{ textAlign: 'center' }}>
              <CardContent>
                <BugReport sx={{ fontSize: 40, color: 'warning.main', mb: 1 }} />
                <Typography variant="h4" sx={{ fontWeight: 600, mb: 0.5 }}>
                  {statistics?.totalVulnerabilities || 0}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Vulnerabilities Found
                </Typography>
              </CardContent>
            </Card>

            <Card sx={{ textAlign: 'center' }}>
              <CardContent>
                <CheckCircle sx={{ fontSize: 40, color: 'success.main', mb: 1 }} />
                <Typography variant="h4" sx={{ fontWeight: 600, mb: 0.5 }}>
                  {statistics && statistics.totalVulnerabilities > 0 
                    ? Math.round((statistics.fixedVulnerabilities / statistics.totalVulnerabilities) * 100)
                    : 0}%
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Fix Rate
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

          {/* Reports Timeline */}
          {statistics?.reportsTimeline && statistics.reportsTimeline.length > 0 && (
            <Card sx={{ mb: 3 }}>
              <CardContent>
                <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                  <TimelineIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                  Reports Timeline (Last 12 Months)
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
          {/* Recent Reports */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                <Assessment sx={{ mr: 1, verticalAlign: 'middle' }} />
                Recent Reports ({reports.length})
              </Typography>
              
              {reports.length > 0 ? (
                <List sx={{ maxHeight: 400, overflow: 'auto' }}>
                  {reports
                    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                    .slice(0, 10)
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
                          <Avatar sx={{ bgcolor: 'secondary.main' }}>
                            <Assessment />
                          </Avatar>
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
                            <Box>
                              <Typography variant="body2" color="text.secondary">
                                {report.protocolName}
                              </Typography>
                              <Typography variant="body2" color="text.secondary">
                                {formatDate(report.date)}
                              </Typography>
                            </Box>
                          }
                        />
                      </ListItem>
                      {index < Math.min(reports.length - 1, 9) && <Divider />}
                    </Box>
                  ))}
                </List>
              ) : (
                <Typography color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
                  No reports available
                </Typography>
              )}
            </CardContent>
          </Card>

          {/* Protocols Audited */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                <Business sx={{ mr: 1, verticalAlign: 'middle' }} />
                Protocols Audited ({auditedProtocols.length})
              </Typography>
              
              {auditedProtocols.length > 0 ? (
                <List sx={{ maxHeight: 300, overflow: 'auto' }}>
                  {auditedProtocols.map((protocol, index) => (
                    <Box key={protocol.id}>
                      <ListItem 
                        sx={{ 
                          px: 0,
                          cursor: 'pointer',
                          '&:hover': { backgroundColor: 'action.hover' },
                          borderRadius: 1
                        }}
                        onClick={() => navigate(`/protocol/${protocol.id}`)}
                      >
                        <ListItemAvatar>
                          <Avatar sx={{ bgcolor: 'primary.main' }}>
                            <Business />
                          </Avatar>
                        </ListItemAvatar>
                        <ListItemText
                          primary={
                            <Typography 
                              variant="subtitle2" 
                              sx={{ fontWeight: 600, wordBreak: 'break-word' }}
                            >
                              {protocol.name}
                            </Typography>
                          }
                          secondary={
                            <Typography variant="body2" color="text.secondary">
                              {reports.filter(r => r.protocolId === protocol.id).length} reports
                            </Typography>
                          }
                        />
                      </ListItem>
                      {index < auditedProtocols.length - 1 && <Divider />}
                    </Box>
                  ))}
                </List>
              ) : (
                <Typography color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
                  No protocols audited
                </Typography>
              )}
            </CardContent>
          </Card>

          {/* Auditor Information */}
          <Card>
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
                    Since
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {formatDate(auditor.date)}
                  </Typography>
                </Box>

                {auditor.createdBy && (
                  <Box>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                      Added By
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {auditor.createdBy}
                    </Typography>
                  </Box>
                )}
              </Stack>
            </CardContent>
          </Card>
        </Box>
      </Box>
    </Box>
  );
};