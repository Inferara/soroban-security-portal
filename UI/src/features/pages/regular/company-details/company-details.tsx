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
  Dashboard,
  Timeline as TimelineIcon,
  Grading
} from '@mui/icons-material';
import { PieChart } from '@mui/x-charts/PieChart';
import { useNavigate } from 'react-router-dom';
import { useCompanyDetails } from './hooks/company-details.hook';
import { SeverityColors } from '../../../../contexts/ThemeContext';
import { getCategoryColor, getCategoryLabel } from '../../../../api/soroban-security-portal/models/vulnerability';

export const CompanyDetails: FC = () => {
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  
  const {
    company,
    protocols,
    reports,
    vulnerabilities,
    statistics,
    loading,
    error
  } = useCompanyDetails();

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
      return 'Unknown';
    }
  };

  const pieData = statistics?.vulnerabilitiesByCategory 
    ? Object.entries(statistics.vulnerabilitiesByCategory).map(([category, count]) => ({
        id: parseInt(category),
        value: count,
        label: getCategoryLabel(parseInt(category)),
        color: getCategoryColor(parseInt(category))
      }))
    : [];

  if (loading) {
    return (
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        minHeight: '50vh' 
      }}>
        <CircularProgress size={60} />
      </Box>
    );
  }

  if (error || !company) {
    return (
      <Box sx={{ p: 3 }}>
        <Button
          variant="contained"
          startIcon={<ArrowBack />}
          onClick={() => navigate(-1)}
          sx={{ mb: 2 }}
        >
          Back
        </Button>
        <Alert severity="error">
          {error || 'Company not found'}
        </Alert>
      </Box>
    );
  }

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
              {company.name}
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 1 }}>
              On Track Since {formatDate(company.date)}
            </Typography>
            {company.url && (
              <MuiLink 
                href={company.url} 
                target="_blank" 
                rel="noopener noreferrer"
                sx={{ 
                  display: 'inline-flex',
                  alignItems: 'center',
                  textDecoration: 'none',
                  '&:hover': { textDecoration: 'underline' }
                }}
              >
                Visit Website <OpenInNew fontSize="small" sx={{ ml: 0.5 }} />
              </MuiLink>
            )}
          </Box>
        </Box>
      </Box>

      {/* Statistics Cards */}
      <Box sx={{ 
        display: 'grid', 
        gridTemplateColumns: { 
          xs: '1fr 1fr', 
          sm: 'repeat(4, 1fr)' 
        }, 
        gap: 2, 
        mb: 3 
      }}>
        <Card sx={{ textAlign: 'center' }}>
          <CardContent>
            <Business sx={{ fontSize: 40, color: SeverityColors['note'], mb: 1 }} />
            <Typography variant="h6" sx={{ fontWeight: 600, mb: 0.5 }}>
              {statistics?.totalProtocols || 0}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Protocols
            </Typography>
          </CardContent>
        </Card>

        <Card sx={{ textAlign: 'center' }}>
          <CardContent>
            <Assessment sx={{ fontSize: 40, color: SeverityColors['note'], mb: 1 }} />
            <Typography variant="h6" sx={{ fontWeight: 600, mb: 0.5 }}>
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
            <Typography variant="h6" sx={{ fontWeight: 600, mb: 0.5 }}>
              {statistics?.totalVulnerabilities || 0}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Vulnerabilities
            </Typography>
          </CardContent>
        </Card>

        <Card sx={{ textAlign: 'center' }}>
          <CardContent>
            <Grading sx={{ fontSize: 40, color: SeverityColors['note'], mb: 1 }} />
            <Typography variant="h6" sx={{ fontWeight: 600, mb: 0.5 }}>
              {statistics ? Math.round((statistics.fixedVulnerabilities / Math.max(statistics.totalVulnerabilities, 1)) * 100) : 0}%
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Fix Rate
            </Typography>
          </CardContent>
        </Card>
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
            label="Analytics" 
          />
        </Tabs>
      </Box>

      {/* Tab Content */}
      {tabValue === 0 && (
        <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 3 }}>
          {/* Main Content */}
          <Box sx={{ flex: 1 }}>
            {/* Company Information */}
            <Card sx={{ mb: 3, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
              <CardContent>
                <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                  <Business sx={{ mr: 1, verticalAlign: 'middle' }} />
                  Company Information
                </Typography>
                
                <Box sx={{ mb: 3 }}>
                  <Typography variant="body1" sx={{ mb: 2, lineHeight: 1.7 }}>
                    <strong>{company.name}</strong> is a blockchain company with {statistics?.totalProtocols || 0} protocols 
                    under security audit. They have completed {statistics?.totalReports || 0} audit reports and identified{' '}
                    {statistics?.totalVulnerabilities || 0} vulnerabilities across their ecosystem.
                  </Typography>
                </Box>
              </CardContent>
            </Card>

            {/* Recent Protocols */}
            <Card sx={{ borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
              <CardContent>
                <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                  <Business sx={{ mr: 1, verticalAlign: 'middle' }} />
                  Protocols ({protocols.length})
                </Typography>
                
                {protocols.length > 0 ? (
                  <List sx={{ maxHeight: 400, overflow: 'auto' }}>
                    {protocols.slice(0, 10).map((protocol, index) => (
                      <Box key={protocol.id}>
                        <ListItem
                          sx={{ 
                            px: 0,
                            cursor: 'pointer',
                            '&:hover': { bgcolor: 'action.hover' },
                            borderRadius: 1
                          }}
                          onClick={() => navigate(`/protocol/${protocol.id}`)}
                        >
                          <ListItemAvatar>
                            <Avatar sx={{ width: 40, height: 40, mr: 2, bgcolor: 'primary.main' }}>
                              <Business />
                            </Avatar>
                          </ListItemAvatar>
                          <ListItemText
                            primary={
                              <Typography component="span" variant="body1" sx={{ fontWeight: 500 }}>
                                {protocol.name}
                              </Typography>
                            }
                          />
                        </ListItem>
                        {index < Math.min(protocols.length, 10) - 1 && <Divider />}
                      </Box>
                    ))}
                  </List>
                ) : (
                  <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
                    No protocols found for this company
                  </Typography>
                )}
              </CardContent>
            </Card>
          </Box>

          {/* Sidebar */}
          <Box sx={{ width: { xs: '100%', md: '350px' }, flexShrink: 0 }}>
            {/* Recent Reports */}
            <Card sx={{ mb: 3, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
              <CardContent>
                <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                  <Assessment sx={{ mr: 1, verticalAlign: 'middle' }} />
                  Recent Reports
                </Typography>
                
                {reports.length > 0 ? (
                  <List sx={{ maxHeight: 300, overflow: 'auto' }}>
                    {reports.slice(0, 5).map((report, index) => (
                      <Box key={report.id}>
                        <ListItem
                          sx={{ 
                            px: 0,
                            cursor: 'pointer',
                            '&:hover': { bgcolor: 'action.hover' },
                            borderRadius: 1
                          }}
                          onClick={() => navigate(`/report/${report.id}`)}
                        >
                          <ListItemAvatar>
                            <Avatar sx={{ width: 32, height: 32, mr: 1, bgcolor: 'info.main' }}>
                              <Assessment fontSize="small" />
                            </Avatar>
                          </ListItemAvatar>
                          <ListItemText
                            primary={
                              <Typography component="span" variant="body2" sx={{ fontWeight: 500 }}>
                                {report.name}
                              </Typography>
                            }
                            secondary={
                              <Typography component="span" variant="caption" color="text.secondary">
                                {formatDate(report.date)}
                              </Typography>
                            }
                          />
                        </ListItem>
                        {index < Math.min(reports.length, 5) - 1 && <Divider />}
                      </Box>
                    ))}
                  </List>
                ) : (
                  <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
                    No reports available
                  </Typography>
                )}
              </CardContent>
            </Card>

            {/* Recent Vulnerabilities */}
            <Card sx={{ borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
              <CardContent>
                <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                  <BugReport sx={{ mr: 1, verticalAlign: 'middle' }} />
                  Recent Vulnerabilities
                </Typography>
                
                {vulnerabilities.length > 0 ? (
                  <List sx={{ maxHeight: 300, overflow: 'auto' }}>
                    {vulnerabilities.slice(0, 5).map((vulnerability, index) => (
                      <Box key={vulnerability.id}>
                        <ListItem
                          sx={{ 
                            px: 0,
                            cursor: 'pointer',
                            '&:hover': { bgcolor: 'action.hover' },
                            borderRadius: 1
                          }}
                          onClick={() => navigate(`/vulnerability/${vulnerability.id}`)}
                        >
                          <ListItemAvatar>
                            <Avatar sx={{ 
                              width: 32, 
                              height: 32, 
                              mr: 1, 
                              bgcolor: getSeverityColor(vulnerability.severity)
                            }}>
                              <BugReport fontSize="small" />
                            </Avatar>
                          </ListItemAvatar>
                          <ListItemText
                            primary={
                              <Typography component="span" variant="body2" sx={{ fontWeight: 500 }}>
                                {vulnerability.title}
                              </Typography>
                            }
                            secondary={
                              <Typography component="span" variant="caption" color="text.secondary">
                                {vulnerability.severity} • {formatDate(vulnerability.date)}
                              </Typography>
                            }
                          />
                        </ListItem>
                        {index < Math.min(vulnerabilities.length, 5) - 1 && <Divider />}
                      </Box>
                    ))}
                  </List>
                ) : (
                  <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
                    No vulnerabilities found
                  </Typography>
                )}
              </CardContent>
            </Card>
          </Box>
        </Box>
      )}

      {tabValue === 1 && (
        <Box sx={{ display: 'flex', flexDirection: { xs: 'column', lg: 'row' }, gap: 3 }}>
          {/* Vulnerability Categories Chart */}
          <Card sx={{ flex: 1, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 3, fontWeight: 600 }}>
                <Grading sx={{ mr: 1, verticalAlign: 'middle' }} />
                Vulnerability Categories
              </Typography>
              
              {pieData.length > 0 ? (
                <Box sx={{ height: 400, display: 'flex', justifyContent: 'center' }}>
                  <PieChart
                    series={[{
                      data: pieData
                    }]}
                    height={300}
                  />
                </Box>
              ) : (
                <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
                  No vulnerability data available
                </Typography>
              )}
            </CardContent>
          </Card>

          {/* Severity Breakdown */}
          <Card sx={{ flex: 1, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 3, fontWeight: 600 }}>
                <Assessment sx={{ mr: 1, verticalAlign: 'middle' }} />
                Severity Breakdown
              </Typography>
              
              {statistics?.severityBreakdown && Object.keys(statistics.severityBreakdown).length > 0 ? (
                <Stack spacing={2}>
                  {Object.entries(statistics.severityBreakdown).map(([severity, count]) => (
                    <Box key={severity} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <Box
                          sx={{
                            width: 12,
                            height: 12,
                            borderRadius: '50%',
                            bgcolor: getSeverityColor(severity),
                            mr: 2
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
                  ))}
                </Stack>
              ) : (
                <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
                  No severity data available
                </Typography>
              )}
            </CardContent>
          </Card>
        </Box>
      )}
    </Box>
  );
};