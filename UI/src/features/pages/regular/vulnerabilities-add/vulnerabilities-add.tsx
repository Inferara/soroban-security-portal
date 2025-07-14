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
  Autocomplete,
  Chip,
} from '@mui/material';
import Grid from '@mui/material/Grid';
import { AuthContextProps, useAuth } from 'react-oidc-context';
import { Role } from '../../../../api/soroban-security-portal/models/role';
import { useNavigate } from 'react-router-dom';
import { useVulnerabilityAdd } from './hooks';
import {
  Vulnerability,
  VulnerabilitySeverity,
  VulnerabilitySource,
} from '../../../../api/soroban-security-portal/models/vulnerability';
import BugReportIcon from '@mui/icons-material/BugReport';
import { Editor } from '@monaco-editor/react';
import { useTheme as useThemeContext } from '../../../../contexts/ThemeContext';
import { ProjectItem } from '../../../../api/soroban-security-portal/models/project';
import { AuditorItem } from '../../../../api/soroban-security-portal/models/auditor';
import { CategoryItem } from '../../../../api/soroban-security-portal/models/category';
import { showError } from '../../../dialog-handler/dialog-handler';

export const AddVulnerability: FC = () => {
  const { themeMode } = useThemeContext();
  const [title, setTitle] = useState('');
  const [reportUrl, setReportUrl] = useState('');
  const [description, setDescription] = useState('');
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [severity, setSeverity] = useState<VulnerabilitySeverity | null>(null);
  const [project, setProject] = useState<ProjectItem | null>(null);
  const [auditor, setAuditor] = useState<AuditorItem | null>(null);
  const [source, setSource] = useState<VulnerabilitySource | null>(null);

  const { severitiesList, categoriesList, projectsList, auditorsList, sourceList, addVulnerability } = useVulnerabilityAdd();
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
      auditor: auditor?.name || '',
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
      !vulnerability.auditor ||
      !vulnerability.source) {
      showError('Please fill all fields');
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
              <Autocomplete
                options={severitiesList}
                value={severity}
                onChange={(_, newValue) => setSeverity(newValue)}
                getOptionLabel={(option) => (option as VulnerabilitySeverity).name}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Severity *"
                    size="small"
                    sx={{ width: '100%' }}
                  />
                )}
              />
            </Grid>
            <Grid size={12}>
              <Autocomplete
                multiple
                options={categoriesList}
                value={categories}
                onChange={(_, newValue) => setCategories(newValue as CategoryItem[])}
                getOptionLabel={(option) => (option as CategoryItem).name}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Category *"
                    size="small"
                    sx={{ width: '100%' }}
                  />
                )}
                renderTags={(value, getTagProps) =>
                  value.map((option, index) => (
                    <Chip
                      {...getTagProps({ index })}
                      key={index}
                      label={(option as CategoryItem).name}
                      size="small"
                      color="primary"
                    />
                  ))
                }
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
              <Autocomplete
                options={sourceList}
                value={source}
                onChange={(_, newValue) => setSource(newValue)}
                getOptionLabel={(option) => (option as VulnerabilitySource).name}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Source *"
                    size="small"
                    sx={{ width: '100%' }}
                  />
                )}
              />
            </Grid>
            {
              source?.name === 'External' && (
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
            )}
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
