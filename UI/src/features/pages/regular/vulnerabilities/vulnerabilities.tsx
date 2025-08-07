import { FC, useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Chip,
  TextField,
  Stack,
  Link as MuiLink,
  Button,
  InputAdornment,
  IconButton,
  Autocomplete,
} from '@mui/material';
import Grid from '@mui/material/Grid';
import SearchIcon from '@mui/icons-material/Search';
import SwapVertIcon from '@mui/icons-material/SwapVert';
import CloseIcon from '@mui/icons-material/Close';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { AuthContextProps, useAuth } from 'react-oidc-context';
import { Role } from '../../../../api/soroban-security-portal/models/role';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useVulnerabilities } from './hooks';
import { VulnerabilitySearch, VulnerabilitySeverity, VulnerabilitySource } from '../../../../api/soroban-security-portal/models/vulnerability';
import FilterListIcon from '@mui/icons-material/FilterList';
import { useTheme } from '../../../../contexts/ThemeContext';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import rehypeRaw from 'rehype-raw';
import rehypeKatex from 'rehype-katex';
import { useEffect } from 'react';
import { ProtocolItem } from '../../../../api/soroban-security-portal/models/protocol';
import { AuditorItem } from '../../../../api/soroban-security-portal/models/auditor';
import { CategoryItem } from '../../../../api/soroban-security-portal/models/category';
import { environment } from '../../../../environments/environment';
import { CodeBlock } from '../../../../components/CodeBlock';
import { CompanyItem } from '../../../../api/soroban-security-portal/models/company';
import 'katex/dist/katex.min.css'; 
import './katex.css';

export const Vulnerabilities: FC = () => {
  // Filter/search state
  const [search, setSearch] = useState('');
  const { themeMode } = useTheme();
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [severities, setSeverities] = useState<VulnerabilitySeverity[]>([]);
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [protocols, setProtocols] = useState<ProtocolItem[]>([]);
  const [companies, setCompanies] = useState<CompanyItem[]>([]);
  const [auditors, setAuditors] = useState<AuditorItem[]>([]);
  const [sources, setSources] = useState<VulnerabilitySource[]>([]);
  const [sortBy] = useState<'date' | 'severity'>('date');
  const [sortDir, setSortDir] = useState<'desc' | 'asc'>('desc');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedVulnerability, setSelectedVulnerability] = useState<any>(null);

  const { 
    severitiesList, 
    categoriesList, 
    companiesList, 
    protocolsList, 
    auditorsList, 
    sourceList, 
    vulnerabilitiesList, 
    searchVulnerabilities, 
    reportsList 
  } = useVulnerabilities();
  const auth = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const canAddVulnerability = (auth: AuthContextProps) =>
    auth.user?.profile.role === Role.Admin || auth.user?.profile.role === Role.Contributor || auth.user?.profile.role === Role.Moderator;

  const toggleSortDirection = () => {
    setSortDir(prev => prev === 'desc' ? 'asc' : 'desc');
  };

  const toggleFilters = () => {
    setShowFilters(prev => !prev);
  };

  const getCategory = (categoryName: string) => {
    const category = categoriesList.find(c => c.name === categoryName);
    return category;
  };

  const handleCardClick = (vulnerability: any) => {
    if (selectedVulnerability === vulnerability) {
      setSelectedVulnerability(null);
    }
    else{
      setSelectedVulnerability(vulnerability);
    }
  };

  const handleCloseProfile = () => {
    setSelectedVulnerability(null);
  };

  const handleChipClick = (filterType: string, value: string) => {
    // Clear all filters
    setSeverities([]);
    setCategories([]);
    setCompanies([]);
    setProtocols([]);
    setAuditors([]);
    setSources([]);
    setSearch('');
    setStartDate(null);
    setEndDate(null);

    // Set the appropriate filter based on the chip type
    switch (filterType) {
      case 'severity':
        const severity = severitiesList.find(s => s.name === value);
        if (severity) {
          setSeverities([severity]);
        }
        break;
      case 'source':
        const source = sourceList.find(s => s.name === value);
        if (source) {
          setSources([source]);
        }
        break;
      case 'company':
        const company = companiesList.find(c => c.name === value);
        if (company) {
          setCompanies([company]);
        }
        break;
      case 'protocol':
        const protocol = protocolsList.find(p => p.name === value);
        if (protocol) {
          setProtocols([protocol]);
        }
        break;
    }

    setShowFilters(true);
    const vulnerabilitySearch: VulnerabilitySearch = {
      severities: filterType === 'severity' ? [value] : [],
      categories: filterType === 'category' ? [value] : [],
      companies: filterType === 'company' ? [value] : [],
      protocols: filterType === 'protocol' ? [value] : [],
      auditors: filterType === 'auditor' ? [value] : [],
      sources: filterType === 'source' ? [value] : [],
      searchText: '',
      from: '',
      to: '',
      sortBy: sortBy,
      sortDirection: sortDir,
    };
    void searchVulnerabilities(vulnerabilitySearch);
  };

  // Apply filters from URL parameters
  useEffect(() => {
    const categoryParam = searchParams.get('category');
    const severityParam = searchParams.get('severity');
    const companyParam = searchParams.get('company');
    const protocolParam = searchParams.get('protocol');
    const sourceParam = searchParams.get('source');

    let hasFilters = false;

    if (categoryParam && categoriesList.length > 0) {
      const category = categoriesList.find(c => c.name === categoryParam);
      if (category) {
        setCategories([category]);
        hasFilters = true;
        console.log('Applied category filter from URL:', categoryParam);
      }
    }

    if (severityParam && severitiesList.length > 0) {
      const severity = severitiesList.find(s => s.name === severityParam);
      if (severity) {
        setSeverities([severity]);
        hasFilters = true;
        console.log('Applied severity filter from URL:', severityParam);
      }
    }

    if (companyParam && companiesList.length > 0) {
      const company = companiesList.find(c => c.name === companyParam);
      if (company) {
        setCompanies([company]);
        hasFilters = true;
        console.log('Applied company filter from URL:', companyParam);
      }
    }

    if (protocolParam && protocolsList.length > 0) {
      const protocol = protocolsList.find(p => p.name === protocolParam);
      if (protocol) {
        setProtocols([protocol]);
        hasFilters = true;
        console.log('Applied protocol filter from URL:', protocolParam);
      }
    }

    if (sourceParam && sourceList.length > 0) {
      const source = sourceList.find(s => s.name === sourceParam);
      if (source) {
        setSources([source]);
        hasFilters = true;
        console.log('Applied source filter from URL:', sourceParam);
      }
    }

    if (hasFilters) {
      setShowFilters(true);
    }
  }, [searchParams, categoriesList, severitiesList, protocolsList, sourceList]);

  // Auto-search when filters are applied from URL
  useEffect(() => {
    if (categoriesList.length > 0 && severitiesList.length > 0 && protocolsList.length > 0 && sourceList.length > 0) {
      const hasUrlFilters = searchParams.get('category') || searchParams.get('severity') || searchParams.get('protocol') || searchParams.get('source');
      if (hasUrlFilters) {
        console.log('Auto-searching with URL filters:', {
          category: searchParams.get('category'),
          severity: searchParams.get('severity'),
          protocol: searchParams.get('protocol'),
          source: searchParams.get('source')
        });
        // Small delay to ensure all filter lists are loaded
        const timer = setTimeout(() => {
          callSearch();
        }, 100);
        return () => clearTimeout(timer);
      }
    }
  }, [categoriesList, severitiesList, protocolsList, sourceList, searchParams]);

  const callSearch = () => {
    const vulnerabilitySearch: VulnerabilitySearch = {
      severities: severities.map(s => s.name),
      categories: categories.map(c => c.name),
      companies: companies.map(c => c.name),
      protocols: protocols.map(p => p.name),
      auditors: auditors.map(a => a.name),
      sources: sources.map(s => s.name),
      searchText: search,
      from: startDate?.toISOString().split('T')[0] || '',
      to: endDate?.toISOString().split('T')[0] || '',
      sortBy: sortBy,
      sortDirection: sortDir,
    };
    void searchVulnerabilities(vulnerabilitySearch);
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Box sx={{ padding: '24px' }}>        
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          {canAddVulnerability(auth) && (
            <Button
              variant="contained"
              color="primary"
              sx={{ fontWeight: 600, borderRadius: 2 }}
              onClick={() => navigate('/vulnerabilities/add')}
            >
              Add Vulnerability
            </Button>
          )}
        </Box>
        {/* Filters and search */}
        <Box sx={{ mb: 3, display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center' }}>
          <TextField
            size="small"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search"
            sx={{ minWidth: 750 }}
            slotProps={{
              input: {
                endAdornment: (
                  <InputAdornment position="end">
                    <SearchIcon />
                  </InputAdornment>
                ),
              }
            }}
          />
          <DatePicker
            label="Start Date"
            value={startDate}
            onChange={(newValue) => setStartDate(newValue)}
            slotProps={{
              textField: {
                size: 'small',
                sx: { minWidth: 150, backgroundColor: themeMode === 'light' ? '#fafafa' : 'background.paper' }
              }
            }}
          />
          <DatePicker
            label="End Date"
            value={endDate}
            onChange={(newValue) => setEndDate(newValue)}
            slotProps={{
              textField: {
                size: 'small',
                sx: { minWidth: 150, backgroundColor: themeMode === 'light' ? '#fafafa' : 'background.paper' }
              }
            }}
          />
          <span style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <IconButton
              onClick={toggleSortDirection}
              sx={{
                border: 1,
                borderColor: 'divider',
                transform: sortDir === 'asc' ? 'rotate(180deg)' : 'none',
                transition: 'transform 0.2s'
              }}
            >
              <SwapVertIcon />
            </IconButton>
            <Typography variant="body2" color="text.secondary" sx={{ width: '30px', fontSize: '1.2rem' }}>
              {sortDir === 'desc' ? '↓' : '↑'}
            </Typography>
          </span>
          <IconButton
            onClick={toggleFilters}
            sx={{
              border: 1,
              borderColor: 'divider',
              bgcolor: showFilters ? 'primary.main' : 'transparent',
              color: showFilters ? 'white' : 'inherit',
              '&:hover': {
                bgcolor: showFilters ? 'primary.dark' : 'action.hover'
              }
            }}
          >
            <FilterListIcon />
          </IconButton>
          <Button
            variant="contained"
            color="primary"
            sx={{ fontWeight: 600, borderRadius: 2, height: 40, alignSelf: 'flex-end' }}
            onClick={() => { callSearch(); }}
          >
            Search
          </Button>
        </Box>
        {showFilters && (
          <Box sx={{ mb: 0, display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center' }}>
            <Autocomplete
              multiple
              options={severitiesList}
              value={severities}
              onChange={(_, newValue) => setSeverities(newValue as VulnerabilitySeverity[])}
              getOptionLabel={(option) => (option as VulnerabilitySeverity).name}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Severity"
                  size="small"
                  sx={{ minWidth: 200 }}
                />
              )}
              renderTags={(value, getTagProps) =>
                value.map((option, index) => (
                  <Chip
                    {...getTagProps({ index })}
                    key={index}
                    label={(option as VulnerabilitySeverity).name}
                    size="small"
                    sx={{
                      bgcolor: (() => {
                        switch ((option as VulnerabilitySeverity).name) {
                          case 'Critical': return '#c72e2b95';
                          case 'High': return '#FF6B3D95';
                          case 'Medium': return '#FFD84D95';
                          case 'Low': return '#569E6795';
                          case 'Note': return '#72F1FF95';
                          default: return '#e0e0e0';
                        }
                      })(),
                      color: '#F2F2F2',
                      fontWeight: 700,
                    }}
                  />
                ))
              }
            />

            <Autocomplete
              multiple
              options={categoriesList}
              value={categories}
              onChange={(_, newValue) => setCategories(newValue as CategoryItem[])}
              getOptionLabel={(option) => (option as CategoryItem).name}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Tags"
                  size="small"
                  sx={{ minWidth: 200 }}
                />
              )}
              renderTags={(value, getTagProps) =>
                value.map((option, index) => (
                  <Chip
                    {...getTagProps({ index })}
                    key={index}
                    label={(option as CategoryItem).name}
                    size="small"
                    sx={{
                      bgcolor: (option as CategoryItem).bgColor,
                      color: (option as CategoryItem).textColor,
                      fontWeight: 700,
                    }}
                  />
                ))
              }
            />
            <Autocomplete
              multiple
              options={companiesList}
              value={companies}
              onChange={(_, newValue) => setCompanies(newValue as CompanyItem[])}
              getOptionLabel={(option) => (option as CompanyItem).name}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Company"
                  size="small"
                  sx={{ minWidth: 200 }}
                />
              )}
              renderTags={(value, getTagProps) =>
                value.map((option, index) => (
                  <Chip
                    {...getTagProps({ index })}
                    key={index}
                    label={(option as CompanyItem).name}
                    size="small"
                    sx={{ bgcolor: '#2b7fa2', color: '#F2F2F2' }}
                  />
                ))
              }
            />
            <Autocomplete
              multiple
              options={protocolsList}
              value={protocols}
              onChange={(_, newValue) => setProtocols(newValue as ProtocolItem[])}
              getOptionLabel={(option) => (option as ProtocolItem).name}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Protocol"
                  size="small"
                  sx={{ minWidth: 200 }}
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
            <Autocomplete
              multiple
              options={auditorsList}
              value={auditors}
              onChange={(_, newValue) => setAuditors(newValue as AuditorItem[])}
              getOptionLabel={(option) => (option as AuditorItem).name}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Auditor"
                  size="small"
                  sx={{ minWidth: 200 }}
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
            <Autocomplete
              multiple
              options={sourceList}
              value={sources}
              onChange={(_, newValue) => setSources(newValue as VulnerabilitySource[])}
              getOptionLabel={(option) => (option as VulnerabilitySource).name}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Report"
                  size="small"
                  sx={{ minWidth: 200 }}
                />
              )}
              renderTags={(value, getTagProps) =>
                value.map((option, index) => (
                  <Chip
                    {...getTagProps({ index })}
                    key={index}
                    label={(option as VulnerabilitySource).name}
                    size="small"
                    sx={{ bgcolor: '#0288d1', color: '#F2F2F2' }}
                  />
                ))
              }
            />
          </Box>
        )}
      </Box>
      <Typography variant="h3" sx={{ pl: 3, pb:3, fontWeight: 600, mb: 1, color: themeMode === 'light' ? '#1A1A1A' : '#F2F2F2' }}>ENGAGE</Typography>
      <Box sx={{ display: 'flex', height: '60vh' }}>
        {/* Vulnerabilities List Section */}
        <Box sx={{ 
          width: selectedVulnerability ? '50%' : '100%', 
          overflow: 'auto', 
          borderColor: 'divider',
          transition: 'width 0.3s ease-in-out',
          '&::-webkit-scrollbar': {
            width: '12px',
          },
          '&::-webkit-scrollbar-track': {
            backgroundColor: 'rgba(0, 0, 0, 0.1)',
            borderRadius: '4px',
          },
          '&::-webkit-scrollbar-thumb': {
            backgroundColor: 'rgba(0, 0, 0, 0.3)',
            borderRadius: '4px',
            '&:hover': {
              backgroundColor: 'rgba(0, 0, 0, 0.5)',
            },
          },
          '&::-webkit-scrollbar-corner': {
            backgroundColor: 'transparent',
          },
        }}>
          <Box sx={{ pl: 3, pr: 3, pb: 3 }}>            
            {/* Vulnerability cards */}
            <Grid container spacing={3}>
              {vulnerabilitiesList.length === 0 && (
                <Grid size={12}>
                  <Typography color="text.secondary" sx={{ textAlign: 'center', mt: 6 }}>
                    No vulnerabilities found for the selected filters.
                  </Typography>
                </Grid>
              )}
              {vulnerabilitiesList.map(vuln => (
                <Grid size={12} key={vuln.id}>
                  <Card 
                    sx={{
                      height: '100%', 
                      display: 'flex', 
                      flexDirection: 'column', 
                      borderRadius: '20px',
                      border: '1px solid',
                      backgroundColor: themeMode === 'light' ? '#fafafa' : '#1A1A1A',
                      borderLeft: `10px solid ${vuln.severity === 'Critical' ? '#c72e2b95' :
                          vuln.severity === 'High' ? '#FF6B3D95' :
                            vuln.severity === 'Medium' ? '#FFD84D95' :
                              vuln.severity === 'Low' ? '#569E6795' :
                                vuln.severity === 'Note' ? '#72F1FF95' :
                                  '#388e3c'}`,
                      cursor: 'pointer',
                      transition: 'all 0.2s ease-in-out',
                      ...(selectedVulnerability?.id === vuln.id && {
                        backgroundColor: '#6a6a6a',
                      })
                    }}
                    onClick={() => handleCardClick(vuln)}
                  >
                    <CardContent sx={{ flexGrow: 1, paddingBottom: '8px !important' }}>
                      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                        <Typography variant="h6" sx={{ fontWeight: 600, flexGrow: 1, textTransform: 'uppercase' }}>
                          {vuln.title}
                        </Typography>
                      </Stack>
                      <Stack direction="row" spacing={1} sx={{ mb: 1 }} alignItems="center">
                        {vuln.categories.map((category, index) => (
                          <Chip key={`${vuln.id}-category-${index}`} label={category} size="small" sx={{ bgcolor: getCategory(category)?.bgColor, color: getCategory(category)?.textColor }} />
                        ))}
                        <Chip label={vuln.protocol} size="small" sx={{ bgcolor: '#7b1fa2', color: '#F2F2F2' }} />
                        <Box sx={{ flexGrow: 1 }} />
                        {vuln.source === 'External' ? (
                          <MuiLink
                            href={vuln.reportUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            sx={{ textDecoration: 'none' }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Button
                              variant="outlined"
                              size="small"
                              sx={{ textTransform: 'none' }}
                            >
                              View Report
                            </Button>
                          </MuiLink>
                        ) : (() => {
                          const report = reportsList.find(report => report.name === vuln.source);
                          if (report) {
                            const url = `${environment.apiUrl}/api/v1/reports/${report.id}/download`;
                            return (
                              <MuiLink
                                href={url}
                                target="_blank"
                                rel="noopener noreferrer"
                                sx={{ textDecoration: 'none' }}
                                onClick={(e) => e.stopPropagation()}
                              >
                                <Button
                                  variant="outlined"
                                  size="small"
                                  sx={{ textTransform: 'none' }}
                                >
                                  View Report
                                </Button>
                              </MuiLink>
                            );
                          }
                          return (
                            <Typography variant="caption" color="text.disabled">
                              No report available
                            </Typography>
                          );
                        })()}
                      </Stack>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </Box>
        </Box>
        {/* Vulnerability Profile Section */}
        {selectedVulnerability && (
          <Box sx={{
            width: '50%', 
            overflow: 'auto', 
            transition: 'width 0.3s ease-in-out',
            '&::-webkit-scrollbar': {
              width: '12px',
            },
            '&::-webkit-scrollbar-track': {
              backgroundColor: 'rgba(0, 0, 0, 0.1)',
              borderRadius: '4px',
            },
            '&::-webkit-scrollbar-thumb': {
              backgroundColor: 'rgba(0, 0, 0, 0.3)',
              borderRadius: '4px',
              '&:hover': {
                backgroundColor: 'rgba(0, 0, 0, 0.5)',
              },
            },
            '&::-webkit-scrollbar-corner': {
              backgroundColor: 'transparent',
            },
          }}>
            <Box sx={{ p: 0 }}>             
              <Card sx={{
                borderRadius: '20px',
                border: '1px solid',
                backgroundColor: themeMode === 'light' ? '#fafafa' : '#1A1A1A',
                mb: 3
              }}>
                <CardContent>
                  <Box sx={{ mb: 2 }}>
                    <Stack spacing={1}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', height: '40px' }}>
                        <Typography variant="body2" color="text.primary">Severity:
                          <Chip 
                            label={selectedVulnerability.severity} 
                            size="small" 
                            sx={{ 
                              marginLeft: '12px',
                              border: '2px solid',
                              backgroundColor: 'transparent',
                              borderColor: (() => {
                                switch (selectedVulnerability.severity) {
                                  case 'Critical': return '#c72e2b95';
                                  case 'High': return '#FF6B3D95';
                                  case 'Medium': return '#FFD84D95';
                                  case 'Low': return '#569E6795';
                                  case 'Note': return '#72F1FF95';
                                  default: return '#e0e0e0';
                                }
                              })(),
                              fontWeight: 700,
                              cursor: 'pointer',
                              '&:hover': {
                                opacity: 0.8,
                                transform: 'scale(1.05)',
                                transition: 'all 0.2s ease-in-out'
                              }
                            }} 
                            onClick={() => handleChipClick('severity', selectedVulnerability.severity)}
                          />
                        </Typography>
                        <IconButton 
                          onClick={handleCloseProfile}
                          sx={{ 
                            color: themeMode === 'light' ? 'text.secondary' : 'text.disabled',
                            '&:hover': {
                              color: 'text.primary'
                            }
                          }}
                        >
                          <CloseIcon />
                        </IconButton>
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', height: '32px' }}>
                        <Typography variant="body2" color="text.primary">Report info:
                          <Chip 
                            label={selectedVulnerability.source} 
                            size="small" 
                            sx={{ 
                              marginLeft: '12px',
                              border: '2px solid',
                              backgroundColor: 'transparent',
                              fontWeight: 700,
                              cursor: 'pointer',
                              '&:hover': {
                                opacity: 0.8,
                                transform: 'scale(1.05)',
                                transition: 'all 0.2s ease-in-out'
                              }
                            }} 
                            onClick={() => handleChipClick('source', selectedVulnerability.source)}
                          />
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', height: '32px' }}>
                        <Typography variant="body2" color="text.primary">Company:
                          <Chip 
                            label={selectedVulnerability.company} 
                            size="small" 
                            sx={{ 
                              marginLeft: '12px',
                              border: '2px solid',
                              backgroundColor: 'transparent',
                              fontWeight: 700,
                              cursor: 'pointer',
                              '&:hover': {
                                opacity: 0.8,
                                transform: 'scale(1.05)',
                                transition: 'all 0.2s ease-in-out'
                              }
                            }} 
                            onClick={() => handleChipClick('company', selectedVulnerability.company)}
                          />
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', height: '32px' }}>
                        <Typography variant="body2" color="text.primary">Protocol:
                          <Chip 
                            label={selectedVulnerability.protocol} 
                            size="small" 
                            sx={{ 
                              marginLeft: '12px',
                              border: '2px solid',
                              backgroundColor: 'transparent',
                              fontWeight: 700,
                              cursor: 'pointer',
                              '&:hover': {
                                opacity: 0.8,
                                transform: 'scale(1.05)',
                                transition: 'all 0.2s ease-in-out'
                              }
                            }} 
                            onClick={() => handleChipClick('protocol', selectedVulnerability.protocol)}
                          />
                        </Typography>
                        <MuiLink
                          href={(() => {
                            const protocol = protocolsList.find(p => p.name === selectedVulnerability.protocol);
                            return protocol?.url || '#';
                          })()}
                          target="_blank"
                          rel="noopener noreferrer"
                          sx={{ textDecoration: 'none' }}
                        >
                          <Button
                            variant="outlined"
                            size="small"
                            sx={{ textTransform: 'none' }}
                          >
                            View source code
                          </Button>
                        </MuiLink>
                      </Box>
                    </Stack>
                  </Box>
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="h6" sx={{ mb: 1, fontWeight: 600, textTransform: 'uppercase' }}>Description</Typography>
                    <Box sx={{ 
                      '& .katex-display': {
                        margin: '1em 0 !important',
                        textAlign: 'center',
                        overflowX: 'auto',
                        overflowY: 'hidden'
                      },
                      '& .katex': {
                        fontSize: '1em !important',
                        lineHeight: '1.2 !important'
                      },
                      '& .katex-inline': {
                        display: 'inline !important',
                        margin: '0 !important',
                        padding: '0 !important'
                      }
                    }}>
                      <ReactMarkdown
                        skipHtml={false}
                        remarkPlugins={[remarkParse, remarkGfm, remarkMath, remarkRehype]}
                        rehypePlugins={[rehypeRaw, rehypeKatex]}
                        components={{
                          code: (props) => {
                            const { node, className, children, ...rest } = props;
                            const inline = (props as any).inline;
                            const match = /language-(\w+)/.exec(className || '');
                            if (!inline && match) {
                              return (
                                <CodeBlock className={className} {...rest}>
                                  {String(children).replace(/\n$/, '')}
                                </CodeBlock>
                              );
                            } else {
                              return (
                                <CodeBlock className={className} inline={true} {...rest}>
                                  {String(children).replace(/\n$/, '')}
                                </CodeBlock>
                              );
                            }
                          },
                          // Handle inline math
                          span: ({ className, children, ...props }) => {
                            if (className && className.includes('math')) {
                              return (
                                <span className={className} {...props}>
                                  {children}
                                </span>
                              );
                            }
                            return <span className={className} {...props}>{children}</span>;
                          },
                          // Handle block math
                          div: ({ className, children, ...props }) => {
                            if (className && className.includes('math')) {
                              return (
                                <div className={className} {...props}>
                                  {children}
                                </div>
                              );
                            }
                            return <div className={className} {...props}>{children}</div>;
                          }
                        }}
                      >
                        {selectedVulnerability.description
                          // Convert escaped dollar signs to regular ones for math rendering
                          .replace(/\\\$/g, '$')
                        }
                      </ReactMarkdown>
                    </Box>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'right' }}>
                    <Typography variant="body2" color="text.secondary">Discovered: {new Date(selectedVulnerability.date).toLocaleDateString()}</Typography>
                  </Box>
                </CardContent>
              </Card>
            </Box>
          </Box>
        )}
      </Box>
    </LocalizationProvider>
  );
};
