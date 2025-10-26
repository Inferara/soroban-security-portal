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
  Tabs,
  Tab
} from '@mui/material';
import { 
  ArrowBack, 
  OpenInNew, 
  Business,
  BugReport,
  Assessment,
  Grading,
  Person,
  Timeline as TimelineIcon,
  Dashboard,
} from '@mui/icons-material';
import { PieChart } from '@mui/x-charts/PieChart';
import { LineChart } from '@mui/x-charts/LineChart';
import { useNavigate } from 'react-router-dom';
import { useAuditorDetails } from './hooks/auditor-details.hook';
import { SeverityColors } from '../../../../contexts/ThemeContext';
import { getCategoryColor, getCategoryLabel, VulnerabilityCategory } from '../../../../api/soroban-security-portal/models/vulnerability';

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

  const [tabValue, setTabValue] = useState(0);

  const fixedValidVulns = statistics?.vulnerabilitiesByCategory![VulnerabilityCategory.Valid] || 0;
  const notFixedValidVulns = Object.entries(statistics?.vulnerabilitiesByCategory || {}).filter(c => Number(c[0]) !== VulnerabilityCategory.Valid).reduce((sum, [, count]) => sum + count, 0);

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

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
  
    const vulnCategoryData = statistics ? Object.entries(statistics.vulnerabilitiesByCategory || {}).map(([categoryId, count]) => ({
      id: Number(categoryId),
      value: count,
      label: getCategoryLabel(Number(categoryId)),
      color: getCategoryColor(Number(categoryId))
    })) : [];

  // Get unique protocols audited by this auditor
  const auditedProtocols = protocols.filter(protocol => 
    reports.some(report => report.protocolId === protocol.id)
  );

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
          <Avatar sx={{ width: 60, height: 60, mr: 2, bgcolor: 'info.main' }}>
            <Person />
          </Avatar>
          <Box sx={{ flexGrow: 1 }}>
            <Typography 
              variant={isMobile ? "h5" : "h4"} 
              sx={{ fontWeight: 600, mb: 0.5, wordBreak: 'break-word' }}
            >
              {auditor.name}
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Security Auditor
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Since {formatDate(auditor.date)}
            </Typography>
          </Box>
        </Box>

        <Stack direction="row" spacing={2} sx={{ mb: 2, flexWrap: 'wrap', gap: 1 }}>
          {auditor.url && (
            <Button
              variant="contained"
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
            icon={<TimelineIcon />} 
            iconPosition="start" 
            label="Activity" 
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
                <Assessment sx={{ fontSize: 40, color: SeverityColors['note'], mb: 1 }} />
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
                <Business sx={{ fontSize: 40, color: SeverityColors['note'], mb: 1 }} />
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
                <BugReport sx={{ fontSize: 40, color: SeverityColors['medium'], mb: 1 }} />
                <Typography variant="h4" sx={{ fontWeight: 600, mb: 0.5 }}>
                  {statistics?.totalVulnerabilities || 0}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Vulnerabilities Reported
                </Typography>
              </CardContent>
            </Card>

            <Card sx={{ textAlign: 'center' }}>
              <CardContent>
                <Grading sx={{ fontSize: 40, color: SeverityColors['note'], mb: 1 }} />
                <Typography variant="h4" sx={{ fontWeight: 600, mb: 0.5 }}>
                  {statistics && statistics.totalVulnerabilities > 0 
                    ? Math.round((fixedValidVulns / (fixedValidVulns + notFixedValidVulns)) * 100)
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
                    {formatDate(auditor.date)}
                  </Typography>
                </Box>
              </Stack>
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
                            <Typography component="span" variant="body2" color="text.secondary">
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
          {/* Recent Reports */}
          <Card>
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
                            <>
                              <Typography variant="body2" color="text.secondary" component="span" sx={{ display: 'block' }}>
                                {report.protocolName}
                              </Typography>
                              <Typography variant="body2" color="text.secondary" component="span" sx={{ display: 'block' }}>
                                {formatDate(report.date)}
                              </Typography>
                            </>
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
        </Box>
      </Box>
      )}

      {/* Second Tab - Activity Timeline */}
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
                          <Avatar sx={{ bgcolor: 'primary.main' }}>
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
                            <Typography component="span" variant="body2" color="text.secondary">
                              Published: {formatDate(report.date)}
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
    </Box>
  );
};