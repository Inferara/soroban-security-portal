import { FC } from 'react';
import React from 'react';
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
  Error as ErrorIcon
} from '@mui/icons-material';
import { PieChart } from '@mui/x-charts/PieChart';
import { LineChart } from '@mui/x-charts/LineChart';
import { useNavigate } from 'react-router-dom';
import { useProtocolDetails } from './hooks/protocol-details.hook';


export const ProtocolDetails: FC = () => {
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  
  const {
    protocol,
    company,
    reports,
    statistics,
    loading,
    error
  } = useProtocolDetails();

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

  if (error || !protocol) {
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
          {error || 'Protocol not found'}
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

  // Prepare audit timeline data
  const auditTimelineData = reports.length > 0 ? (() => {
    const timelineMap = new Map<string, { month: string; audits: number; auditors: Set<string> }>();
    
    reports.forEach(report => {
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
  })() : [];

  // Get unique auditors for easy access
  const uniqueAuditors = reports.length > 0 ? Array.from(new Set(reports.map(r => ({
    id: r.auditorId,
    name: r.auditorName
  })))) : [];

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
          <Avatar sx={{ width: 60, height: 60, mr: 2, bgcolor: 'primary.main' }}>
            <Business />
          </Avatar>
          <Box sx={{ flexGrow: 1 }}>
            <Typography 
              variant={isMobile ? "h5" : "h4"} 
              sx={{ fontWeight: 600, mb: 0.5 }}
            >
              {protocol.name}
            </Typography>
            {company && (
              <Typography variant="h6" color="text.secondary">
                by {company.name}
              </Typography>
            )}
          </Box>
        </Box>

        <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
          {protocol.url && (
            <Button
              variant="outlined"
              startIcon={<OpenInNew />}
              href={protocol.url}
              target="_blank"
              rel="noopener noreferrer"
            >
              Visit Website
            </Button>
          )}
          {company?.url && (
            <Button
              variant="text"
              startIcon={<OpenInNew />}
              href={company.url}
              target="_blank"
              rel="noopener noreferrer"
            >
              Company Website
            </Button>
          )}
        </Stack>
      </Box>

      <Box sx={{ 
        display: 'flex', 
        flexDirection: { xs: 'column', lg: 'row' },
        gap: 3
      }}>
        {/* Statistics Cards */}
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
                <BugReport sx={{ fontSize: 40, color: 'warning.main', mb: 1 }} />
                <Typography variant="h4" sx={{ fontWeight: 600, mb: 0.5 }}>
                  {statistics?.totalVulnerabilities || 0}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Vulnerabilities
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

            {/* Audit Timeline Chart */}
            <Card>
              <CardContent>
                <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                  Audit Timeline
                </Typography>
                {auditTimelineData.length > 0 ? (
                  <Box sx={{ height: 300, width: '100%' }}>
                    <LineChart
                      xAxis={[{
                        scaleType: 'point',
                        data: auditTimelineData.map(item => item.month),
                        label: 'Month'
                      }]}
                      series={[
                        {
                          data: auditTimelineData.map(item => item.audits),
                          label: 'Audit Reports',
                          color: '#1976d2'
                        }
                      ]}
                      width={isMobile ? 280 : 350}
                      height={300}
                      margin={{ left: 50, right: 20, top: 20, bottom: 60 }}
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

        {/* Reports and Timeline */}
        <Box sx={{ flex: { lg: 0.4 } }}>
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
                          <Avatar sx={{ bgcolor: 'secondary.main' }}>
                            {auditor.name.charAt(0).toUpperCase()}
                          </Avatar>
                        </ListItemAvatar>
                        <ListItemText
                          primary={auditor.name}
                          secondary={`${reports.filter(r => r.auditorName === auditor.name).length} reports`}
                        />
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/auditor/${auditor.id}`);
                          }}
                        >
                          View Profile
                        </Button>
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
          <Card sx={{ mb: 3 }}>
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
                                by{' '}
                                <Button
                                  variant="text"
                                  size="small"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    navigate(`/auditor/${report.auditorId}`);
                                  }}
                                  sx={{ 
                                    textTransform: 'none', 
                                    minWidth: 'auto', 
                                    p: 0,
                                    textDecoration: 'underline',
                                    '&:hover': { textDecoration: 'none' }
                                  }}
                                >
                                  {report.auditorName}
                                </Button>
                              </Typography>
                              <Typography variant="body2" color="text.secondary">
                                {formatDate(report.date)}
                              </Typography>
                            </Box>
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

          {/* Protocol Information */}
          <Card>
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
                    <Typography variant="body2" color="text.secondary">
                      {company.name}
                    </Typography>
                  </Box>
                )}

                <Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                    Added Date
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {formatDate(protocol.date)}
                  </Typography>
                </Box>

                {protocol.createdBy && (
                  <Box>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                      Added By
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {protocol.createdBy}
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