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
  useTheme,
  Autocomplete,
  Chip,
  Alert,
  IconButton,
  Tooltip,
} from '@mui/material';
import Grid from '@mui/material/Grid';
import { AuthContextProps, useAuth } from 'react-oidc-context';
import { Role } from '../../../../api/soroban-security-portal/models/role';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useVulnerabilityAdd } from './hooks';
import {
  Vulnerability,
  VulnerabilitySeverity,
  VulnerabilitySource,
  VulnerabilityCategory,
  VulnerabilityCategories,
} from '../../../../api/soroban-security-portal/models/vulnerability';
import BugReportIcon from '@mui/icons-material/BugReport';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import DeleteIcon from '@mui/icons-material/Delete';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import { Editor } from '@monaco-editor/react';
import { useTheme as useThemeContext } from '../../../../contexts/ThemeContext';
import { ProtocolItem } from '../../../../api/soroban-security-portal/models/protocol';
import { AuditorItem } from '../../../../api/soroban-security-portal/models/auditor';
import { TagItem } from '../../../../api/soroban-security-portal/models/tag';
import { showError } from '../../../dialog-handler/dialog-handler';
import { environment } from '../../../../environments/environment';
import { CompanyItem } from '../../../../api/soroban-security-portal/models/company';

export const AddVulnerability: FC = () => {
  const { themeMode } = useThemeContext();
  const [title, setTitle] = useState('');
  const [reportUrl, setReportUrl] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState<TagItem[]>([]);
  const [severity, setSeverity] = useState<VulnerabilitySeverity | null>(null);
  const [protocol, setProtocol] = useState<ProtocolItem | null>(null);
  const [company, setCompany] = useState<CompanyItem | null>(null);
  const [auditor, setAuditor] = useState<AuditorItem | null>(null);
  const [source, setSource] = useState<VulnerabilitySource | null>(null);
  const [category, setCategory] = useState<VulnerabilityCategory | null>(null);
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [imageError, setImageError] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const { 
    severitiesList, 
    tagsList, 
    protocolsList, 
    companiesList, 
    auditorsList, 
    sourceList, 
    addVulnerability, 
    isUploading, 
    picturesContainerGuid 
  } = useVulnerabilityAdd();

  const auth = useAuth();
  const navigate = useNavigate();
  const theme = useTheme();
  const [searchParams] = useSearchParams();
  
  const canAddVulnerability = (auth: AuthContextProps) => 
    auth.user?.profile.role === Role.Admin || auth.user?.profile.role === Role.Contributor || auth.user?.profile.role === Role.Moderator;

  if (!canAddVulnerability(auth)) {
    navigate('/vulnerabilities');
  }

  const handleSetProtocol = (newProtocol: ProtocolItem | null) => {
    setProtocol(newProtocol);
    const company = companiesList.find(c => c.id === newProtocol?.companyId);
    if (company) {
      setCompany(company);
    } else {
      setCompany(null);
    }
    if (source?.protocolId != newProtocol?.id) {
      setSource(null);
    }
  };

  const handleSetReport = (newSource: VulnerabilitySource | null) => {
    setSource(newSource);
    const auditor = auditorsList.find(a => a.id === newSource?.auditorId);
    if (auditor) {
      setAuditor(auditor);
    } else {
      setAuditor(null);
    }
    if (protocol?.id != newSource?.protocolId) {
      setProtocol(protocolsList.find(p => p.id === newSource?.protocolId) || null);
    }
  };

  const handleSetAuditor = (newAuditor: AuditorItem | null) => {
    setAuditor(newAuditor);
    if (source?.auditorId != newAuditor?.id) {
      setSource(null);
    }
  };

  // Handle URL parameters for pre-filling form
  useEffect(() => {
    if (protocolsList.length > 0 && auditorsList.length > 0 && sourceList.length > 0) {
      const protocolParam = searchParams.get('protocol');
      const auditorParam = searchParams.get('auditor');  
      const reportParam = searchParams.get('report');

      if (protocolParam) {
        const protocolToSet = protocolsList.find(p => p.name === protocolParam || p.id.toString() === protocolParam);
        if (protocolToSet) {
          handleSetProtocol(protocolToSet);
        }
      }

      if (auditorParam) {
        const auditorToSet = auditorsList.find(a => a.name === auditorParam || a.id.toString() === auditorParam);
        if (auditorToSet) {
          handleSetAuditor(auditorToSet);
        }
      }

      if (reportParam) {
        const reportToSet = sourceList.find(s => s.name === reportParam || s.id.toString() === reportParam);
        if (reportToSet) {
          handleSetReport(reportToSet);
        }
      }
    }
  }, [searchParams, protocolsList, auditorsList, sourceList]);

  const validateAndAddImage = (file: File) => {
    // Check if file is an image
    if (!file.type.startsWith('image/')) {
      setImageError('Please select image files only');
      return;
    }
    
    // Check file size (max 5MB per image)
    if (file.size > 5 * 1024 * 1024) {
      setImageError('Each image must be less than 5MB');
      return;
    }

    // Check if we already have 5 images
    if (selectedImages.length >= 5) {
      setImageError('Maximum 5 images allowed');
      return;
    }
    
    setSelectedImages(prev => [...prev, file]);
    setImageError('');
  };

  const handleImageSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files) {
      Array.from(files).forEach(file => {
        validateAndAddImage(file);
      });
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
    Array.from(files).forEach(file => {
      validateAndAddImage(file);
    });
  };

  const handleRemoveImage = (index: number) => {
    setSelectedImages(prev => prev.filter((_, i) => i !== index));
    setImageError('');
  };

  const handleCopyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      // You could add a toast notification here if you have one
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
    }
  };

  const getReports = (): VulnerabilitySource[] => {
    let res = sourceList;
    if (protocol) {
      res = res.filter(s => s.protocolId === protocol.id);
    }
    if (auditor) {
      res = res.filter(s => s.auditorId === auditor.id);
    }
    return res;
  }

  const addNewVulnerability = async () => {
    const vulnerability: Vulnerability = {
      id: 0,
      title: title,
      description: description,
      severity: severity?.name || '',
      tags: tags.map(c => c.name),
      companyName: company?.name || '',
      companyId: company?.id || -1,
      protocolName: protocol?.name || '',
      protocolId: protocol?.id || -1,
      auditorName: auditor?.name || '',
      auditorId: auditor?.id || -1,
      reportName: source?.name || '',
      reportId: source?.id || -1,
      reportUrl: reportUrl,
      picturesContainerGuid: picturesContainerGuid,
      date: new Date(),
      status: 'new',
      category: category === null ? VulnerabilityCategory.NA : category,
    };
    if (!vulnerability.title || 
      !vulnerability.description || 
      !vulnerability.severity ||
      !vulnerability.protocolName || 
      !vulnerability.auditorName ||
      vulnerability.category === null) {
      showError('Please fill all fields');
      return;
    }
    try {
      await addVulnerability(vulnerability, selectedImages.length > 0 ? selectedImages : undefined);
      navigate('/vulnerabilities');
    } catch (error) {
      console.error('Error adding vulnerability:', error);
    }
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
          title={<Typography variant="h4" sx={{ fontWeight: 700, color: 'background.default' }}>Add Vulnerability</Typography>}
          subheader={<Typography variant="subtitle1" sx={{ color: 'background.default' }}>Report a new security issue</Typography>}
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
              <Box sx={{ bgcolor: 'background.default', px: 2, py: 1.5, borderRadius: 2, mb: 2, mt: 1 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 600, color: 'primary.contrastText' }}>
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
                options={tagsList}
                value={tags}
                onChange={(_, newValue) => setTags(newValue as TagItem[])}
                getOptionLabel={(option) => (option as TagItem).name}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Tags"
                    size="small"
                    sx={{ width: '100%' }}
                  />
                )}
                renderTags={(value, getTagProps) =>
                  value.map((option, index) => (
                    <Chip
                      {...getTagProps({ index })}
                      key={index}
                      label={(option as TagItem).name}
                      size="small"
                      sx={{
                        bgcolor: (option as TagItem).bgColor,
                        color: (option as TagItem).textColor,
                        fontWeight: 700,
                      }}
                    />
                  ))
                }
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
                onChange={(_, newValue) => handleSetAuditor(newValue)}
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
                options={Object.entries(VulnerabilityCategories).map(([_, value]) => value)}
                value={category !== null ? VulnerabilityCategories.find(c => c.id === category) || null : null}
                onChange={(_, newValue) => setCategory(newValue ? newValue.id : null)}
                getOptionLabel={(option) => (option as any).label}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Category *"
                    size="small"
                    sx={{ width: '100%' }}
                  />
                )}
              />
            </Grid>
            <Grid size={12}>
              <Autocomplete
                options={getReports()}
                value={source}
                onChange={(_, newValue) => handleSetReport(newValue)}
                getOptionLabel={(option) => (option as VulnerabilitySource).name}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Report"
                    size="small"
                    sx={{ width: '100%' }}
                  />
                )}
              />
            </Grid>
            <Grid size={12}>
              <Box sx={{ bgcolor: 'background.default', px: 2, py: 1.5, borderRadius: 2, mb: 2, mt: 1 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 600, color: 'primary.contrastText' }}>
                  Images (Optional). Files Container Guid: {picturesContainerGuid}
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
                onClick={() => imageInputRef.current?.click()}
              >
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleImageSelect}
                  style={{ display: 'none' }}
                />
                {selectedImages.length === 0 ? (
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
                      {isDragOver ? 'Drop images here' : 'Upload Images'}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      Drag and drop up to 5 images here, or click to browse
                    </Typography>
                    <Button
                      variant="contained"
                      onClick={(e) => {
                        e.stopPropagation();
                        imageInputRef.current?.click();
                      }}
                    >
                      Choose Images
                    </Button>
                  </Box>
                ) : (
                  <Box>
                    <Typography variant="h6" sx={{ mb: 2 }}>
                      Selected Images ({selectedImages.length}/5)
                    </Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, justifyContent: 'center' }}>
                      {selectedImages.map((image, index) => (
                        <Box
                          key={index}
                          sx={{
                            position: 'relative',
                            border: `2px solid ${theme.palette.divider}`,
                            borderRadius: 2,
                            overflow: 'hidden',
                            width: 200,
                            height: 320,
                            bgcolor: theme.palette.background.paper,
                            boxShadow: theme.shadows[2],
                          }}
                        >
                          <img
                            src={URL.createObjectURL(image)}
                            alt={`Image ${index + 1}`}
                            style={{
                              width: '200px',
                              height: '180px',
                              objectFit: 'cover',
                            }}
                          />
                          <Box
                            sx={{
                              p: 1,
                              bgcolor: theme.palette.background.default,
                              borderTop: `1px solid ${theme.palette.divider}`,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              minHeight: 40,
                            }}
                          >
                            <Typography
                              variant="caption"
                              sx={{
                                fontSize: '0.7rem',
                                color: theme.palette.text.secondary,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                flex: 1,
                                mr: 0.5,
                              }}
                            >
                              ![{image.name}]({environment.apiUrl}/file/{picturesContainerGuid}/{image.name})
                            </Typography>
                            <Box sx={{ display: 'flex', gap: 0.5 }}>
                              <Tooltip title="Copy filename">
                                <IconButton
                                  size="small"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleCopyToClipboard(`![${image.name}](${environment.apiUrl}/file/${picturesContainerGuid}/${image.name})`);
                                  }}
                                  sx={{
                                    p: 0.5,
                                    color: theme.palette.text.secondary,
                                    '&:hover': {
                                      color: theme.palette.primary.main,
                                      bgcolor: theme.palette.action.hover,
                                    },
                                  }}
                                >
                                  <ContentCopyIcon sx={{ fontSize: 14 }} />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Remove image">
                                <IconButton
                                  size="small"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleRemoveImage(index);
                                  }}
                                  sx={{
                                    p: 0.5,
                                    color: theme.palette.error.main,
                                    '&:hover': {
                                      bgcolor: theme.palette.error.light + '20',
                                    },
                                  }}
                                >
                                  <DeleteIcon sx={{ fontSize: 14 }} />
                                </IconButton>
                              </Tooltip>
                            </Box>
                          </Box>
                        </Box>
                      ))}
                    </Box>
                    {selectedImages.length < 5 && (
                      <Button
                        variant="contained"
                        onClick={(e) => {
                          e.stopPropagation();
                          imageInputRef.current?.click();
                        }}
                      >
                        Add More Images
                      </Button>
                    )}
                  </Box>
                )}
              </Box>
              {imageError && (
                <Alert severity="error" sx={{ mt: 1 }}>
                  {imageError}
                </Alert>
              )}
              <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                Maximum 5 images, 5MB each. Supported formats: JPG, PNG, GIF, WebP.
              </Typography>
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
                  variant="contained"
                  onClick={() => navigate('/vulnerabilities')}
                >
                  Cancel
                </Button>
                <Button
                  variant="contained"
                  color="success"
                  onClick={addNewVulnerability}
                  disabled={isUploading}
                >
                  {isUploading ? 'Adding Vulnerability...' : 'Add Vulnerability'}
                </Button>
              </Box>
            </Grid>
          </Grid>
        </CardContent>
      </Paper>
    </Box>
  );
};
