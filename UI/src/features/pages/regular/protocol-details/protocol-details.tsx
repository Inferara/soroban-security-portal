import { FC, useState } from 'react';
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
  Link as MuiLink,
  Divider,
  Tabs,
  Tab
} from '@mui/material';
import { 
  ArrowBack, 
  OpenInNew, 
  Business, 
  Assessment, 
  BugReport,
  TaskAlt,
  Dashboard,
  Timeline as TimelineIcon,
  Grading
} from '@mui/icons-material';
import { PieChart } from '@mui/x-charts/PieChart';
import { LineChart } from '@mui/x-charts/LineChart';
import { useNavigate } from 'react-router-dom';
import { useProtocolDetails } from './hooks/protocol-details.hook';
import { SeverityColors } from '../../../../contexts/ThemeContext';
import { getCategoryColor, getCategoryLabel } from '../../../../api/soroban-security-portal/models/vulnerability';



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

  const [tabValue, setTabValue] = useState(0);

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

  const vulnCategoryData = statistics ? Object.entries(statistics.vulnerabilitiesByCategory || {}).map(([categoryId, count]) => ({
    id: Number(categoryId),
    value: count,
    label: getCategoryLabel(Number(categoryId)),
    color: getCategoryColor(Number(categoryId))
  })) : [];

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
          variant="contained"
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
              sx={{ fontWeight: 600, mb: 0.5, wordBreak: 'break-word' }}
            >
              {protocol.name}
            </Typography>
            {company && (
              <Typography variant="body1" color="text.secondary">
                by{' '}
                <Typography
                  component="span"
                  variant="body1"
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

        <Stack direction="row" spacing={2} sx={{ mb: 2, flexWrap: 'wrap', gap: 1 }}>
          {protocol.url && (
            <Button
              variant="contained"
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
              variant="contained"
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
            label="Audit History" 
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
                <BugReport sx={{ fontSize: 40, color: SeverityColors['medium'], mb: 1 }} />
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
                <TaskAlt sx={{ fontSize: 40, color: SeverityColors['low'], mb: 1 }} />
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
                <Grading sx={{ fontSize: 40, color: SeverityColors['note'], mb: 1 }} />
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

            {/* Vulnerability Categories Chart */}
            <Card>
              <CardContent>
                <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                  Vulnerabilities by Category
                </Typography>
                {vulnCategoryData.length > 0 ? (
                  <Box sx={{ height: 300, display: 'flex', justifyContent: 'center' }}>
                    <PieChart
                      series={[{
                        data: vulnCategoryData,
                        highlightScope: { fade: 'global', highlight: 'item' },
                      }]}
                      // width={isMobile ? 280 : 350}
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

        {/* Reports and Timeline */}
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
                    On Tack Since
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {formatDate(protocol.date)}
                  </Typography>
                </Box>
              </Stack>
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
                          <Avatar sx={{ bgcolor: 'secondary.main' }}>
                            {auditor.name.charAt(0).toUpperCase()}
                          </Avatar>
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
                            <React.Fragment>
                              <Typography component="span" variant="body2" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                                by&nbsp;
                                <MuiLink
                                  rel="noopener noreferrer"
                                  sx={{ textDecoration: 'none', flexShrink: 0, width: { xs: '100%', sm: 'auto' } }}
                                  onClick={() => {
                                    navigate(`/auditor/${report.auditorId}`);
                                  }}
                                >
                                  {report.auditorName}
                                </MuiLink>
                              </Typography>
                              <Typography component="span" variant="body2" color="text.secondary" sx={{ display: 'block' }}>
                                {formatDate(report.date)}
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

      {/* Second Tab - Audit History */}
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
                      <Avatar sx={{ 
                        bgcolor: theme.palette.primary.main,
                        width: 48,
                        height: 48
                      }}>
                        <BugReport />
                      </Avatar>
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
                            Created: {formatDate(report.date)}
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
    </Box>
  );
};