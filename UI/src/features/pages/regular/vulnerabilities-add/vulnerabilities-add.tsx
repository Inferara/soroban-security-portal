import { FC, useState } from 'react';
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
} from '@mui/material';
import Grid from '@mui/material/Grid';
import { ChipsControl } from '../../../components/chips-control/chips-control';
import { AuthContextProps, useAuth } from 'react-oidc-context';
import { Role } from '../../../../api/soroban-security-portal/models/role';
import { useNavigate } from 'react-router-dom';
import { useVulnerabilityAdd } from './hooks';
import {
  Vulnerability,
  VulnerabilityCategory,
  VulnerabilityProject,
  VulnerabilitySeverity,
  VulnerabilitySource,
} from '../../../../api/soroban-security-portal/models/vulnerability';
import BugReportIcon from '@mui/icons-material/BugReport';
import { Editor } from '@monaco-editor/react';
import { useTheme as useThemeContext } from '../../../../contexts/ThemeContext';

export const AddVulnerability: FC = () => {
  const { themeMode } = useThemeContext();
  const [title, setTitle] = useState('');
  const [reportUrl, setReportUrl] = useState('');
  const [description, setDescription] = useState('');
  const [categories, setCategories] = useState<VulnerabilityCategory[]>([]);
  const [severity, setSeverity] = useState<VulnerabilitySeverity | undefined>(undefined);
  const [project, setProject] = useState<VulnerabilityProject | undefined>(undefined);
  const [source, setSource] = useState<VulnerabilitySource | undefined>(undefined);

  const { severitiesList, categoriesList, projectsList, sourceList, addVulnerability } = useVulnerabilityAdd();
  const auth = useAuth();
  const navigate = useNavigate();
  const theme = useTheme();
  
  const canAddVulnerability = (auth: AuthContextProps) => 
    auth.user?.profile.role === Role.Admin || auth.user?.profile.role === Role.Contributor || auth.user?.profile.role === Role.Moderator;

  if (!canAddVulnerability(auth)) {
    navigate('/vulnerabilities');
  }

  const addNewVulnerability = () => {
    const vulnerability: Vulnerability = {
      id: 0,
      title: title,
      description: description,
      severity: severity?.name || '',
      categories: categories.map(c => c.name),
      project: project?.name || '',
      source: source?.name || '',
      reportUrl: reportUrl,
      date: new Date(),
      status: 'new',
    };
    if (!vulnerability.title || 
      !vulnerability.description || 
      !vulnerability.severity || 
      vulnerability.categories.length === 0 || 
      !vulnerability.project || 
      !vulnerability.source) {
      alert('Please fill all fields');
      return;
    }
    void addVulnerability(vulnerability);
    navigate('/vulnerabilities');
  };

  return (
    <Box sx={{ minHeight: '100vh', py: { xs: 2, md: 6 }, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Paper
        elevation={6}
        sx={{
          width: '100%',
          maxWidth: 900,
          minWidth: 320,
          mx: 'auto',
          borderRadius: 5,
          overflow: 'hidden',
        }}
      >
        <CardHeader
          avatar={
            <Avatar sx={{ bgcolor: theme.palette.primary.main, width: 56, height: 56 }}>
              <BugReportIcon fontSize="large" />
            </Avatar>
          }
          title={<Typography variant="h4" sx={{ fontWeight: 700, color: theme.palette.primary.dark }}>Add Vulnerability</Typography>}
          subheader={<Typography variant="subtitle1" sx={{ color: 'text.secondary' }}>Report a new security issue</Typography>}
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
                label="Title"
                value={title}
                onChange={e => setTitle(e.target.value)}
                required
              />
            </Grid>
            <Grid size={12}>
              <TextField
                fullWidth
                size="small"
                variant="outlined"
                label="Report URL"
                value={reportUrl}
                onChange={e => setReportUrl(e.target.value)}
                placeholder="https://example.com/vulnerability-report"
              />
            </Grid>
            <Grid size={12}>
              <span style={{ fontWeight: 600, color: theme.palette.text.primary }}>
                Description
              </span>
              <Editor              
                height="40vh"
                language="markdown"          
                value={description}
                theme={themeMode === 'light' ? 'vs' : 'vs-dark'} 
                onChange={(value) => setDescription(value ?? '')}
              />
            </Grid>

            {/* Classification Section */}
            <Grid size={12}>
              <Box sx={{ bgcolor: theme.palette.warning.light, px: 2, py: 1.5, borderRadius: 2, mb: 2, mt: 1 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 600, color: theme.palette.warning.dark }}>
                  Classification
                </Typography>
              </Box>
            </Grid>
            <Grid size={12}>
              <ChipsControl
                chips={severitiesList}
                chipsSelected={severity ? [severity] : []}
                controlText="Severity *"
                chipText={s => (s as VulnerabilitySeverity).name}
                chipColor={s => {
                  switch ((s as VulnerabilitySeverity).name) {
                    case 'Critical': return '#d32f2f';
                    case 'High': return '#f57c00';
                    case 'Medium': return '#fbc02d';
                    case 'Low': return '#388e3c';
                    default: return '#e0e0e0';
                  }}}
                onChange={v => setSeverity(v[0] as VulnerabilitySeverity | undefined)}
                style={{ width: '100%' }}
              />
            </Grid>
            <Grid size={12}>
              <ChipsControl
                chips={categoriesList}
                chipsSelected={categories}
                controlText="Category *"
                chipText={s => (s as VulnerabilityCategory).name}
                chipColor={() => theme.palette.primary.main}
                onChange={v => setCategories(v as VulnerabilityCategory[])}
                style={{ width: '100%' }}
              />
            </Grid>
            <Grid size={12}>
              <ChipsControl
                chips={projectsList}
                chipsSelected={project ? [project] : []}
                controlText="Project *"
                chipText={s => (s as VulnerabilityProject).name}
                chipColor={() => theme.palette.secondary.main}
                onChange={v => setProject(v[0] as VulnerabilityProject | undefined)}
                style={{ width: '100%' }}
              />
            </Grid>
            <Grid size={12}>
              <ChipsControl
                chips={sourceList}
                chipsSelected={source ? [source] : []}
                controlText="Source *"
                chipText={s => (s as VulnerabilitySource).name}
                chipColor={() => theme.palette.info.main}
                onChange={v => setSource(v[0] as VulnerabilitySource | undefined)}
                style={{ width: '100%' }}
              />
            </Grid>
            <Grid size={12}>
              <Divider sx={{ my: 3 }} />
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
                <Button
                  variant="outlined"
                  sx={{ fontWeight: 600, borderRadius: 2, minWidth: 120 }}
                  onClick={() => navigate('/vulnerabilities')}
                >
                  Cancel
                </Button>
                <Button
                  variant="contained"
                  color="success"
                  sx={{ fontWeight: 600, borderRadius: 2, minWidth: 180, fontSize: 18, py: 1.2, boxShadow: 2 }}
                  onClick={addNewVulnerability}
                >
                  Add Vulnerability
                </Button>
              </Box>
            </Grid>
          </Grid>
        </CardContent>
      </Paper>
    </Box>
  );
};
