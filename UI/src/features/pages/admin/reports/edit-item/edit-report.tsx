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
import { ProjectItem } from '../../../../../api/soroban-security-portal/models/project';
import { AuditorItem } from '../../../../../api/soroban-security-portal/models/auditor';
import { showError } from '../../../../dialog-handler/dialog-handler';
import { CurrentPageState } from '../../admin-main-window/current-page-slice';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';

export const EditReport: FC = () => {
  const [name, setName] = useState('');
  const [project, setProject] = useState<ProjectItem | null>(null);
  const [auditor, setAuditor] = useState<AuditorItem | null>(null);
  const [date, setDate] = useState<Date | null>(null);

  const currentPageState: CurrentPageState = {
    pageName: 'Edit Report',
    pageCode: 'editReport',
    pageUrl: window.location.pathname,
    routePath: 'admin/reports/edit',
  };

  const { 
    editReport, 
    report, 
    projectsList,
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

  // Populate form when report data is loaded
  useEffect(() => {
    if (report) {
      setName(report.name);
      
      // Find and set project
      const foundProject = projectsList.find((p: ProjectItem) => p.name === report.project);
      setProject(foundProject || null);
      
      // Find and set auditor
      const foundAuditor = auditorsList.find((a: AuditorItem) => a.name === report.auditor);
      setAuditor(foundAuditor || null);
      
      // Set date
      if (report.date) {
        setDate(new Date(report.date));
      }
    }
  }, [report, projectsList, auditorsList]);

  const handleEditReport = async () => {
    if (!report) return;

    const updatedReport: Report = {
      ...report,
      name: name,
      project: project?.name || '',
      auditor: auditor?.name || '',
      date: date?.toISOString() || '',
    };

    if (!updatedReport.name || 
      !updatedReport.project || 
      !updatedReport.auditor ||
      !updatedReport.date) {
      showError('Please fill all required fields');
      return;
    }

    const success = await editReport(updatedReport);
    if (success) {
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
            title={<Typography variant="h4" sx={{ fontWeight: 700, color: theme.palette.primary.dark }}>Edit Report</Typography>}
            subheader={<Typography variant="subtitle1" sx={{ color: 'text.secondary' }}>Update report information</Typography>}
            sx={{ bgcolor: theme.palette.primary.light, px: 4, py: 3, borderBottom: `1px solid ${theme.palette.divider}` }}
          />
          <CardContent sx={{ px: { xs: 2, sm: 4, md: 6 }, py: { xs: 2, sm: 4 } }}>
            <Grid container spacing={4}>
              {/* Basic Information Section */}
              <Grid size={12}>
                <Box sx={{ bgcolor: theme.palette.success.light, px: 2, py: 1.5, borderRadius: 2, mb: 2 }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600, color: theme.palette.success.dark }}>
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
                  options={projectsList}
                  value={project}
                  onChange={(_, newValue) => setProject(newValue)}
                  getOptionLabel={(option) => (option as ProjectItem).name}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Project *"
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
                    variant="outlined"
                    sx={{ fontWeight: 600, borderRadius: 2, minWidth: 120 }}
                    onClick={() => navigate('/admin/reports')}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="contained"
                    color="success"
                    sx={{ fontWeight: 600, borderRadius: 2, minWidth: 180, fontSize: 18, py: 1.2, boxShadow: 2 }}
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