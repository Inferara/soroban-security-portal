import { FC, useEffect, useState } from 'react';
import {
  Box,
  Typography,
  TextField,
  Button,
  Paper,
  Divider,
  CardContent,
  CardHeader,
  Avatar,
  useTheme,
  Autocomplete,
  Grid,
} from '@mui/material';
import { AuthContextProps, useAuth } from 'react-oidc-context';
import { Role } from '../../../../../api/soroban-security-portal/models/role';
import { useNavigate } from 'react-router-dom';
import { useEditReport } from './hooks';
import { Report } from '../../../../../api/soroban-security-portal/models/report';
import ReportIcon from '@mui/icons-material/Report';
import { ProtocolItem } from '../../../../../api/soroban-security-portal/models/protocol';
import { AuditorItem } from '../../../../../api/soroban-security-portal/models/auditor';
import { showError } from '../../../../dialog-handler/dialog-handler';
import { CurrentPageState } from '../../admin-main-window/current-page-slice';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { CompanyItem } from '../../../../../api/soroban-security-portal/models/company';

export const EditReport: FC = () => {
  const [name, setName] = useState('');
  const [company, setCompany] = useState<CompanyItem | null>(null);
  const [protocol, setProtocol] = useState<ProtocolItem | null>(null);
  const [auditor, setAuditor] = useState<AuditorItem | null>(null);
  const [date, setDate] = useState<Date | null>(null);
  const [isFormLoaded, setIsFormLoaded] = useState(false);

  const storageKey = `editReportFormData_${window.location.pathname.split('/').pop()}`;

  const currentPageState: CurrentPageState = {
    pageName: 'Edit Report',
    pageCode: 'editReport',
    pageUrl: window.location.pathname,
    routePath: 'admin/reports/edit',
  };

  const { 
    editReport, 
    report, 
    companiesList,
    protocolsList,
    auditorsList,
  } = useEditReport({ currentPageState });

  const auth = useAuth();
  const navigate = useNavigate();
  const theme = useTheme();

  // Check if user has permission to edit reports
  const canEditReport = (auth: AuthContextProps) => 
    auth.user?.profile.role === Role.Admin || auth.user?.profile.role === Role.Moderator;

  if (!canEditReport(auth)) {
    navigate('/admin/reports');
  }

  const handleSetProtocol = (newProtocol: ProtocolItem | null) => {
    setProtocol(newProtocol);
    const company = companiesList.find(c => c.id === newProtocol?.companyId);
    if (company) {
      setCompany(company);
    } else {
      setCompany(null);
    }
  };

  // Populate form when report data is loaded
  useEffect(() => {
    if (report && protocolsList.length > 0 && companiesList.length > 0 && auditorsList.length > 0) {
      // Try to load from sessionStorage first
      const savedData = sessionStorage.getItem(storageKey);
      if (savedData) {
        try {
          const parsedData = JSON.parse(savedData);
          setName(parsedData.name || report.name);
          if (parsedData.date) {
            setDate(new Date(parsedData.date));
          } else if (report.date) {
            setDate(new Date(report.date));
          }
          
          // Restore protocol and company
          if (parsedData.protocolId) {
            const foundProtocol = protocolsList.find(p => p.id === parsedData.protocolId);
            if (foundProtocol) {
              setProtocol(foundProtocol);
              const foundCompany = companiesList.find(c => c.id === foundProtocol.companyId);
              if (foundCompany) setCompany(foundCompany);
            }
          } else {
            const foundCompany = companiesList.find((c: CompanyItem) => c.id === report.companyId);
            setCompany(foundCompany || null);
            const foundProtocol = protocolsList.find((p: ProtocolItem) => p.id === report.protocolId);
            setProtocol(foundProtocol || null);
          }
          
          // Restore auditor
          if (parsedData.auditorId) {
            const foundAuditor = auditorsList.find(a => a.id === parsedData.auditorId);
            setAuditor(foundAuditor || null);
          } else {
            const foundAuditor = auditorsList.find((a: AuditorItem) => a.id === report.auditorId);
            setAuditor(foundAuditor || null);
          }
        } catch (error) {
          console.error('Error loading saved form data:', error);
          // Fall back to original report data
          setName(report.name);
          const foundCompany = companiesList.find((c: CompanyItem) => c.id === report.companyId);
          setCompany(foundCompany || null);
          const foundProtocol = protocolsList.find((p: ProtocolItem) => p.id === report.protocolId);
          setProtocol(foundProtocol || null);
          const foundAuditor = auditorsList.find((a: AuditorItem) => a.id === report.auditorId);
          setAuditor(foundAuditor || null);
          if (report.date) {
            setDate(new Date(report.date));
          }
        }
      } else {
        // No saved data, use report data
        setName(report.name);
        const foundCompany = companiesList.find((c: CompanyItem) => c.id === report.companyId);
        setCompany(foundCompany || null);
        const foundProtocol = protocolsList.find((p: ProtocolItem) => p.id === report.protocolId);
        setProtocol(foundProtocol || null);
        const foundAuditor = auditorsList.find((a: AuditorItem) => a.id === report.auditorId);
        setAuditor(foundAuditor || null);
        if (report.date) {
          setDate(new Date(report.date));
        }
      }
      setIsFormLoaded(true);
    }
  }, [report, protocolsList, companiesList, auditorsList, storageKey]);

  // Save form data to sessionStorage whenever it changes
  useEffect(() => {
    if (isFormLoaded && report) {
      const formData = {
        name,
        date: date?.toISOString(),
        protocolId: protocol?.id,
        auditorId: auditor?.id,
      };
      sessionStorage.setItem(storageKey, JSON.stringify(formData));
    }
  }, [name, date, protocol, auditor, isFormLoaded, report, storageKey]);

  const handleEditReport = async () => {
    if (!report) return;

    const updatedReport: Report = {
      ...report,
      name: name,
      protocolId: protocol?.id || -1,
      protocolName: protocol?.name || '',
      auditorId: auditor?.id || -1,
      auditorName: auditor?.name || '',
      companyName: company?.name || '',
      companyId: company?.id || -1,
      date: date?.toISOString() || '',
    };

    if (!updatedReport.name || 
      !updatedReport.companyId || 
      !updatedReport.protocolId || 
      !updatedReport.auditorId ||
      !updatedReport.date) {
      showError('Please fill all required fields');
      return;
    }

    const success = await editReport(updatedReport);
    if (success) {
      sessionStorage.removeItem(storageKey);
      navigate('/admin/reports');
    } else {
      showError('Failed to update report');
    }
  };

  if (!report) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <Typography variant="h6">Loading report...</Typography>
      </Box>
    );
  }

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Box sx={{ minHeight: '100vh', justifyContent: 'center' }}>
        <Paper
          elevation={6}
          sx={{
            width: '100%',
            maxWidth: 1200,
            minWidth: 320,
            mx: 'auto',
            borderRadius: 5,
            overflow: 'hidden',
          }}
        >
          <CardHeader
            avatar={
              <Avatar sx={{ bgcolor: theme.palette.primary.main, width: 56, height: 56 }}>
                <ReportIcon fontSize="large" />
              </Avatar>
            }
            title={<Typography variant="h4" sx={{ fontWeight: 700, color: 'background.default' }}>Edit Report</Typography>}
            subheader={<Typography variant="subtitle1" sx={{ color: 'background.default' }}>Update report information</Typography>}
            sx={{ bgcolor: theme.palette.primary.light, px: 4, py: 3, borderBottom: `1px solid ${theme.palette.divider}` }}
          />
          <CardContent sx={{ px: { xs: 2, sm: 4, md: 6 }, py: { xs: 2, sm: 4 } }}>
            <Grid container spacing={4}>
              {/* Basic Information Section */}
              <Grid size={12}>
                <Box sx={{ bgcolor: 'background.default', px: 2, py: 1.5, borderRadius: 2, mb: 2 }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600, color: 'primary.contrastText' }}>
                    Basic Information
                  </Typography>
                </Box>
              </Grid>
              <Grid size={12}>
                <TextField
                  fullWidth
                  size="small"
                  variant="outlined"
                  label="Report Name"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  required
                />
              </Grid>
              <Grid size={12}>
                <Autocomplete
                  options={protocolsList}
                  value={protocol}
                  onChange={(_, newValue) => handleSetProtocol(newValue)}
                  getOptionLabel={(option) => (option as ProtocolItem).name}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Protocol *"
                      size="small"
                      sx={{ width: '100%' }}
                    />
                  )}
                />
              </Grid>
              <Grid size={12}>
                <Autocomplete
                  options={auditorsList}
                  value={auditor}
                  onChange={(_, newValue) => setAuditor(newValue)}
                  getOptionLabel={(option) => (option as AuditorItem).name}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Auditor *"
                      size="small"
                      sx={{ width: '100%' }}
                    />
                  )}
                />
              </Grid>
              <Grid size={12}>
                <DatePicker
                  label="Date *"
                  value={date}
                  onChange={(newDate) => setDate(newDate)}
                  slotProps={{
                    textField: {
                      size: 'small',
                      fullWidth: true,
                    },
                  }}
                />
              </Grid>
              <Grid size={12}>
                <Divider sx={{ my: 3 }} />
                <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
                  <Button
                    variant="contained"
                    onClick={() => navigate('/admin/reports')}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="contained"
                    color="success"
                    onClick={handleEditReport}
                  >
                    Update Report
                  </Button>
                </Box>
              </Grid>
            </Grid>
          </CardContent>
        </Paper>
      </Box>
    </LocalizationProvider>
  );
}; 