import { FC, useState, useRef, useEffect } from 'react';
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
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useReportAdd } from './hooks';
import ReportIcon from '@mui/icons-material/Report';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import DeleteIcon from '@mui/icons-material/Delete';
import { AddReport as AddReportItem } from '../../../../api/soroban-security-portal/models/report';
import { ProtocolItem } from '../../../../api/soroban-security-portal/models/protocol';
import { AuditorItem } from '../../../../api/soroban-security-portal/models/auditor';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { showError } from '../../../../features/dialog-handler/dialog-handler';
import { CompanyItem } from '../../../../api/soroban-security-portal/models/company';
import { useAppAuth } from '../../../authentication/useAppAuth';
import { canEdit } from '../../../authentication/authPermissions';

const STORAGE_KEY = 'addReportFormData';

export const AddReport: FC = () => {
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [protocol, setProtocol] = useState<ProtocolItem | null>(null);
  const [company, setCompany] = useState<CompanyItem | null>(null);
  const [auditor, setAuditor] = useState<AuditorItem | null>(null);
  const [date, setDate] = useState<Date | null>(new Date());
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isFormLoaded, setIsFormLoaded] = useState(false);
  //TODO when set protocol or auditor or a company, filter what we have, not choose the first one
  const { addReport, isUploading, protocolsList, auditorsList, companiesList } = useReportAdd();
  const { auth, isAdmin, isModerator, isContributor } = useAppAuth();
  const navigate = useNavigate();
  const theme = useTheme();
  const [searchParams] = useSearchParams();

  // Redirect unauthorized users only after everything is loaded
  useEffect(() => {
    const isDataLoaded = protocolsList.length > 0 && auditorsList.length > 0 && companiesList.length > 0;
    if (!auth.isLoading && isDataLoaded && !canEdit(auth)) {
      navigate('/reports');
    }
  }, [auth.isLoading, auth.isAuthenticated, auth.user, protocolsList, auditorsList, companiesList, navigate]);
  
  const handleSetProtocol = (newProtocol: ProtocolItem | null) => {
    setProtocol(newProtocol);
    const company = companiesList.find(c => c.id === newProtocol?.companyId);
    if (company) {
      setCompany(company);
    } else {
      setCompany(null);
    }
  };

  const handleSetCompany = (newCompany: CompanyItem | null) => {
    if (newCompany) {
      setCompany(newCompany);
    } else {
      setCompany(null);
    }
    const protocols = protocolsList.filter(p => p.companyId === newCompany?.id);
    setProtocol(protocols.length > 0 ? protocols[0] : null);
  };

  // Load form data - URL parameters take priority over sessionStorage
  useEffect(() => {
    if (protocolsList.length > 0 && auditorsList.length > 0 && companiesList.length > 0) {
      // Check URL parameters first
      const protocolParam = searchParams.get('protocol');
      const auditorParam = searchParams.get('auditor');
      const companyParam = searchParams.get('company');

      // Track which fields are set by URL params
      let protocolFromUrl: ProtocolItem | null = null;
      let auditorFromUrl: AuditorItem | null = null;
      let companyFromUrl: CompanyItem | null = null;

      if (protocolParam) {
        protocolFromUrl = protocolsList.find(p => p.name === protocolParam || p.id.toString() === protocolParam) || null;
      }

      if (auditorParam) {
        auditorFromUrl = auditorsList.find(a => a.name === auditorParam || a.id.toString() === auditorParam) || null;
      }

      if (companyParam) {
        companyFromUrl = companiesList.find(c => c.name === companyParam || c.id.toString() === companyParam) || null;
      }

      // Load saved data from sessionStorage
      const savedData = sessionStorage.getItem(STORAGE_KEY);
      let parsedData: any = null;
      if (savedData) {
        try {
          parsedData = JSON.parse(savedData);
        } catch (error) {
          console.error('Error loading saved form data:', error);
        }
      }

      // Apply data: URL params override sessionStorage
      if (parsedData) {
        setTitle(parsedData.title || '');
        setUrl(parsedData.url || '');
        if (parsedData.date) {
          setDate(new Date(parsedData.date));
        }
      }

      // Protocol: URL param takes priority
      if (protocolFromUrl) {
        handleSetProtocol(protocolFromUrl);
      } else if (parsedData?.protocolId) {
        const foundProtocol = protocolsList.find(p => p.id === parsedData.protocolId);
        if (foundProtocol) {
          handleSetProtocol(foundProtocol);
        }
      }

      // Company: URL param takes priority
      if (companyFromUrl) {
        handleSetCompany(companyFromUrl);
      } else if (!protocolFromUrl && parsedData?.companyId) {
        // Only set saved company if protocol wasn't set from URL (to avoid conflicts)
        const foundCompany = companiesList.find(c => c.id === parsedData.companyId);
        if (foundCompany) setCompany(foundCompany);
      }

      // Auditor: URL param takes priority
      if (auditorFromUrl) {
        setAuditor(auditorFromUrl);
      } else if (parsedData?.auditorId) {
        const foundAuditor = auditorsList.find(a => a.id === parsedData.auditorId);
        if (foundAuditor) setAuditor(foundAuditor);
      }

      setIsFormLoaded(true);
    }
  }, [searchParams, protocolsList, auditorsList, companiesList]);

  // Save form data to sessionStorage whenever it changes
  useEffect(() => {
    if (isFormLoaded) {
      const formData = {
        title,
        url,
        date: date?.toISOString(),
        protocolId: protocol?.id,
        companyId: company?.id,
        auditorId: auditor?.id,
      };
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(formData));
    }
  }, [title, url, date, protocol, company, auditor, isFormLoaded]);

  const validateAndSetFile = (file: File) => {
    // Check if file is PDF
    if (file.type !== 'application/pdf') {
      setFileError('Please select a PDF file');
      setSelectedFile(null);
      return;
    }
    
    // Check file size (max 10MB)
    if (!isAdmin && file.size > 10 * 1024 * 1024) {
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
    let validationErrors: string[] = [];
    if (!title) {
      validationErrors.push('Please fill in the title');
    }
    if (!company) {
      validationErrors.push('Please select a company');
    }
    if (!protocol) {
      validationErrors.push('Please select a protocol');
    }
    if (!auditor) {
      validationErrors.push('Please select an auditor');
    }
    if (!selectedFile && !url) {
      validationErrors.push('Please provide either a PDF file or a URL');
    }

    if (validationErrors.length > 0) {
      showError(validationErrors.map(e => e + '.').join('\n'));
      return;
    }

    const report: AddReportItem = {
      id: 0,
      title: title,
      url: url,
      protocolId: protocol?.id || -1,
      auditorId: auditor?.id || -1,
      date: date?.toISOString() || '',
    };

    try {
      await addReport(report, selectedFile);
      sessionStorage.removeItem(STORAGE_KEY);
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
            title={<Typography variant="h4" sx={{ fontWeight: 700, color: 'background.default' }}>Add Report</Typography>}
            subheader={<Typography variant="subtitle1" sx={{ color: 'background.default' }}>Upload a new security report</Typography>}
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
                  label="Title"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  required
                />
              </Grid>
              <Grid size={12}>
                <Autocomplete
                  options={companiesList}
                  value={company}
                  onChange={(_, newValue) => handleSetCompany(newValue as CompanyItem)}
                  getOptionLabel={(option) => (option as CompanyItem).name}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Company"
                      size="small"
                      sx={{ minWidth: 290 }}
                      required
                    />
                  )}
                  renderTags={(value, getTagProps) =>
                    value.map((option, index) => (
                      <Chip
                        {...getTagProps({ index })}
                        key={index}
                        label={(option as CompanyItem).name}
                        size="small"
                        sx={{ bgcolor: '#7b1fa2', color: '#F2F2F2' }}
                      />
                    ))
                  }
                />
                <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                  {isContributor ? "Company missed? Please contact a moderator or admin." : (
                    (isModerator || isAdmin) ? <span>Company missed? <a href="/admin/companies/add" target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'underline', cursor: 'pointer' }}>Add it here</a></span> : ""
                  )}
                </Typography>
              </Grid> 
              <Grid size={12}>
                <Autocomplete
                  options={protocolsList}
                  value={protocol}
                  onChange={(_, newValue) => handleSetProtocol(newValue as ProtocolItem)}
                  getOptionLabel={(option) => (option as ProtocolItem).name}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Protocol"
                      size="small"
                      sx={{ minWidth: 290 }}
                      required
                    />
                  )}
                  renderTags={(value, getTagProps) =>
                    value.map((option, index) => (
                      <Chip
                        {...getTagProps({ index })}
                        key={index}
                        label={(option as ProtocolItem).name}
                        size="small"
                        sx={{ bgcolor: '#7b1fa2', color: '#F2F2F2' }}
                      />
                    ))
                  }
                />
                <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                  {isContributor ? "Protocol missed? Please contact a moderator or admin." : (
                    (isModerator || isAdmin) ? <span>Protocol missed? <a href="/admin/protocols/add" target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'underline', cursor: 'pointer' }}>Add it here</a></span> : ""
                  )}
                </Typography>
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
                      required
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
                <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                  {isContributor ? "Auditor missed? Please contact a moderator or admin." : (
                    (isModerator || isAdmin) ? <span>Auditor missed? <a href="/admin/auditors/add" target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'underline', cursor: 'pointer' }}>Add it here</a></span> : ""
                  )}
                </Typography>  
              </Grid>
              <Grid size={12}>
                <DatePicker
                  label="Report Date *"
                  value={date}
                  onChange={(newValue) => setDate(newValue)}
                  slotProps={{
                    textField: {
                      size: 'small',
                      sx: { width: '100%' },
                      onClick: (e) => {
                        e.currentTarget.querySelector('button')?.click();
                      }
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
                <Box sx={{ bgcolor: 'background.default', px: 2, py: 1.5, borderRadius: 2, mb: 2, mt: 1 }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600, color: 'primary.contrastText' }}>
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
                        variant="contained"
                        onClick={(e) => {
                          e.stopPropagation();
                          fileInputRef.current?.click();
                        }}
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
                    variant="contained"
                    onClick={() => navigate('/reports')}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="contained" 
                    color="success"
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