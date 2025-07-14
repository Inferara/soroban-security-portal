import { FC, useState, useRef } from 'react';
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
  Alert,
  IconButton,
  useTheme,
  Autocomplete,
  Chip,
} from '@mui/material';
import Grid from '@mui/material/Grid';
import { AuthContextProps, useAuth } from 'react-oidc-context';
import { Role } from '../../../../api/soroban-security-portal/models/role';
import { useNavigate } from 'react-router-dom';
import { useReportAdd } from './hooks';
import ReportIcon from '@mui/icons-material/Report';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import DeleteIcon from '@mui/icons-material/Delete';
import { AddReport as AddReportItem } from '../../../../api/soroban-security-portal/models/report';
import { ProjectItem } from '../../../../api/soroban-security-portal/models/project';
import { AuditorItem } from '../../../../api/soroban-security-portal/models/auditor';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { showError } from '../../../../features/dialog-handler/dialog-handler';

export const AddReport: FC = () => {
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [project, setProject] = useState<ProjectItem | null>(null);
  const [auditor, setAuditor] = useState<AuditorItem | null>(null);
  const [date, setDate] = useState<Date | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { addReport, isUploading, projectsList, auditorsList } = useReportAdd();
  const auth = useAuth();
  const navigate = useNavigate();
  const theme = useTheme();
  
  const canAddReport = (auth: AuthContextProps) => 
    auth.user?.profile.role === Role.Admin || auth.user?.profile.role === Role.Contributor || auth.user?.profile.role === Role.Moderator;

  if (!canAddReport(auth)) {
    navigate('/reports');
  }

  const validateAndSetFile = (file: File) => {
    // Check if file is PDF
    if (file.type !== 'application/pdf') {
      setFileError('Please select a PDF file');
      setSelectedFile(null);
      return;
    }
    
    // Check file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      setFileError('File size must be less than 10MB');
      setSelectedFile(null);
      return;
    }
    
    setSelectedFile(file);
    setFileError('');
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      validateAndSetFile(file);
    }
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragOver(false);
    
    const files = event.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0];
      validateAndSetFile(file);
    }
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    setFileError('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const addNewReport = async () => {
    if (!title) {
      showError('Please fill all required fields');
      return;
    }

    if (!selectedFile && !url) {
      showError('Please provide either a PDF file or a URL');
      return;
    }

    const report: AddReportItem = {
      id: 0,
      title: title,
      url: url,
      project: project?.name || '',
      auditor: auditor?.name || '',
      date: date?.toISOString() || '',
    };

    try {
      await addReport(report, selectedFile);
      navigate('/reports');
    } catch (error) {
      console.error('Error adding report:', error);
    }
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
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
                <ReportIcon fontSize="large" />
              </Avatar>
            }
            title={<Typography variant="h4" sx={{ fontWeight: 700, color: theme.palette.primary.dark }}>Add Report</Typography>}
            subheader={<Typography variant="subtitle1" sx={{ color: 'text.secondary' }}>Upload a new security report</Typography>}
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
                <Autocomplete
                  options={projectsList}
                  value={project}
                  onChange={(_, newValue) => setProject(newValue as ProjectItem)}
                  getOptionLabel={(option) => (option as ProjectItem).name}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Project"
                      size="small"
                      sx={{ minWidth: 290 }}
                    />
                  )}
                  renderTags={(value, getTagProps) =>
                    value.map((option, index) => (
                      <Chip
                        {...getTagProps({ index })}
                        key={index}
                        label={(option as ProjectItem).name}
                        size="small"
                        sx={{ bgcolor: '#7b1fa2', color: '#F2F2F2' }}
                      />
                    ))
                  }
                />
              </Grid>
              <Grid size={12}>
                <Autocomplete
                  options={auditorsList}
                  value={auditor}
                  onChange={(_, newValue) => setAuditor(newValue as AuditorItem)}
                  getOptionLabel={(option) => (option as AuditorItem).name}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Auditor"
                      size="small"
                      sx={{ minWidth: 290 }}
                    />
                  )}
                  renderTags={(value, getTagProps) =>
                    value.map((option, index) => (
                      <Chip
                        {...getTagProps({ index })}
                        key={index}
                        label={(option as AuditorItem).name}
                        size="small"
                        sx={{ bgcolor: '#0918d1', color: '#F2F2F2' }}
                      />
                    ))
                  }
                />  
              </Grid>
              <Grid size={12}>
                <DatePicker
                  label="Report Date"
                  value={date}
                  onChange={(newValue) => setDate(newValue)}
                  slotProps={{
                    textField: {
                      size: 'small',
                      sx: { width: '100%' }
                    }
                  }}
                />
              </Grid>
              <Grid size={12}>
                <TextField
                  fullWidth
                  size="small"
                  variant="outlined"
                  label="URL (optional if PDF is not uploaded)"
                  value={url}
                  onChange={e => setUrl(e.target.value)}
                  placeholder="https://example.com/report"
                />
              </Grid>
              <Grid size={12}>
                <Box sx={{ bgcolor: theme.palette.warning.light, px: 2, py: 1.5, borderRadius: 2, mb: 2, mt: 1 }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600, color: theme.palette.warning.dark }}>
                    File Upload
                  </Typography>
                </Box>
              </Grid>
              <Grid size={12}>
                <Box
                  sx={{
                    border: `2px dashed ${isDragOver ? theme.palette.primary.main : theme.palette.divider}`,
                    borderRadius: 2,
                    p: 3,
                    textAlign: 'center',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease-in-out',
                    backgroundColor: isDragOver ? theme.palette.primary.light + '20' : 'transparent',
                    ...(isDragOver && {
                      borderStyle: 'solid',
                      boxShadow: `0 0 0 2px ${theme.palette.primary.main}40`,
                      transform: 'scale(1.02)',
                    }),
                  }}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf"
                    onChange={handleFileSelect}
                    style={{ display: 'none' }}
                  />
                  {!selectedFile ? (
                    <Box>
                      <CloudUploadIcon 
                        sx={{ 
                          fontSize: 48, 
                          color: isDragOver ? theme.palette.primary.main : theme.palette.text.secondary, 
                          mb: 2,
                          transition: 'color 0.2s ease-in-out'
                        }} 
                      />
                      <Typography variant="h6" sx={{ mb: 1 }}>
                        {isDragOver ? 'Drop PDF file here' : 'Upload PDF Report'}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        Drag and drop a PDF file here, or click to browse
                      </Typography>
                      <Button
                        variant="outlined"
                        onClick={(e) => {
                          e.stopPropagation();
                          fileInputRef.current?.click();
                        }}
                        sx={{ borderRadius: 2 }}
                      >
                        Choose File
                      </Button>
                    </Box>
                  ) : (
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <ReportIcon sx={{ mr: 2, color: theme.palette.primary.main }} />
                        <Box>
                          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                            {selectedFile.name}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                          </Typography>
                        </Box>
                      </Box>
                      <IconButton 
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveFile();
                        }} 
                        color="error"
                      >
                        <DeleteIcon />
                      </IconButton>
                    </Box>
                  )}
                </Box>
                {fileError && (
                  <Alert severity="error" sx={{ mt: 1 }}>
                    {fileError}
                  </Alert>
                )}
                <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                  Maximum file size: 10MB. Only PDF files are accepted.
                </Typography>
              </Grid>

              <Grid size={12}>
                <Divider sx={{ my: 3 }} />
                <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
                  <Button
                    variant="outlined"
                    sx={{ fontWeight: 600, borderRadius: 2, minWidth: 120 }}
                    onClick={() => navigate('/reports')}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="contained"
                    color="success"
                    sx={{ fontWeight: 600, borderRadius: 2, minWidth: 180, fontSize: 18, py: 1.2, boxShadow: 2 }}
                    onClick={addNewReport}
                    disabled={isUploading}
                  >
                    {isUploading ? 'Uploading...' : 'Add Report'}
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