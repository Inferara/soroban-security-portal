import React, { FC, useState, useEffect, useRef } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Chip,
  TextField,
  Stack,
  Button,
  InputAdornment,
  IconButton,
  Autocomplete,
  Pagination,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  CircularProgress,
} from '@mui/material';
import Grid from '@mui/material/Grid';
import SearchIcon from '@mui/icons-material/Search';
import SwapVertIcon from '@mui/icons-material/SwapVert';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { AuthContextProps, useAuth } from 'react-oidc-context';
import { isAuthorized, Role } from '../../../../api/soroban-security-portal/models/role';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useVulnerabilities } from './hooks';
import { VulnerabilitySearch, VulnerabilitySeverity, VulnerabilitySource } from '../../../../api/soroban-security-portal/models/vulnerability';
import FilterListIcon from '@mui/icons-material/FilterList';
import { useTheme } from '../../../../contexts/ThemeContext';
import { ProtocolItem } from '../../../../api/soroban-security-portal/models/protocol';
import { AuditorItem } from '../../../../api/soroban-security-portal/models/auditor';
import { CategoryItem } from '../../../../api/soroban-security-portal/models/category';
import { environment } from '../../../../environments/environment';
import { CompanyItem } from '../../../../api/soroban-security-portal/models/company';
import { showMessage } from '../../../dialog-handler/dialog-handler';
import 'katex/dist/katex.min.css';
import './katex.css';
import ReactGA from 'react-ga4';
import { VulnerabilityCard } from './vulnerability-card';

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
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [isLoading, setIsLoading] = useState(true);
  const currentPageRef = useRef(currentPage);

  // Update ref when currentPage changes
  useEffect(() => {
    currentPageRef.current = currentPage;
  }, [currentPage]);

  useEffect(() => {
    ReactGA.send({ hitType: "pageview", page: "/vulnerabilities", title: "Vulnerabilities Page" });
  }, [])

  const {
    severitiesList,
    categoriesList,
    companiesList,
    protocolsList,
    auditorsList,
    sourceList,
    vulnerabilitiesList,
    reportsList,
    searchVulnerabilities,
    totalItems,
    setPage,
    setItemsPerPage,
    isLoadingInitial,
  } = useVulnerabilities();

  useEffect(() => {
    setIsLoading(isLoadingInitial);
  }, [isLoadingInitial]);

  const auth = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const canAddVulnerability = (auth: AuthContextProps) =>
    auth.user?.profile.role === Role.Admin || auth.user?.profile.role === Role.Contributor || auth.user?.profile.role === Role.Moderator;

  const [isOnSmallScreen, setIsOnSmallScreen] = useState(window.innerWidth < 650);

  useEffect(() => {
    const handleResize = () => {
      setIsOnSmallScreen(window.innerWidth < 650);
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  const canDownloadReport = (auth: AuthContextProps) => isAuthorized(auth);

  const toggleSortDirection = () => {
    setSortDir(prev => prev === 'desc' ? 'asc' : 'desc');
    callSearch();
  };

  const toggleFilters = () => {
    setShowFilters(prev => !prev);
  };

  const clearAllFilters = () => {
    setSeverities([]);
    setCategories([]);
    setCompanies([]);
    setProtocols([]);
    setAuditors([]);
    setSources([]);
    setSearch('');
    setStartDate(null);
    setEndDate(null);
    setCurrentPage(1);
  };

  const handlePageChange = (_: React.ChangeEvent<unknown>, page: number) => {
    setCurrentPage(page);
    setPage(page);
    // Trigger search immediately when page changes
    setTimeout(() => {
      if (totalItems > 0) {
        callSearch();
      }
    }, 0);
  };

  const handlePageSizeChange = (event: any) => {
    const newPageSize = event.target.value;
    const newTotalPages = Math.ceil(totalItems / newPageSize);

    // Calculate the new current page to keep the user roughly in the same position
    const newCurrentPage = Math.min(currentPage, newTotalPages);

    setPageSize(newPageSize);
    setItemsPerPage(newPageSize);
    setCurrentPage(newCurrentPage);
    setPage(newCurrentPage);

    // Trigger search immediately when page size changes
    setTimeout(() => {
      if (totalItems > 0) {
        callSearch();
      }
    }, 0);
  };

  const getCategory = (categoryName: string) => {
    const category = categoriesList.find(c => c.name === categoryName);
    return category;
  };

  const handleCardClick = (vulnerability: any) => {
    if (selectedVulnerability === vulnerability) {
      setSelectedVulnerability(null);
    }
    else {
      setSelectedVulnerability(vulnerability);
      ReactGA.event({ category: "Vulnerability", action: "view", label: "Open Vulnerability Preview" });
    }
  };

  const handleCloseProfile = () => {
    setSelectedVulnerability(null);
  };

  const handleDownloadReport = (reportId: number) => {
    if (!canDownloadReport(auth)) {
      showMessage("Log in to download the report");
      ReactGA.event({ category: "Report", action: "download", label: `Unauthorized attempt to download the report ${reportId}` });
      return;
    }
    const link = document.createElement('a');
    link.href = `${environment.apiUrl}/api/v1/reports/${reportId}/download?token=${auth.user?.access_token}`;
    link.setAttribute('download', '');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    ReactGA.event({ category: "Report", action: "view", label: `Downloaded report ${reportId}` });
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
    setCurrentPage(1); // Reset to first page when filters change

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
      reports: filterType === 'source' ? [value] : [],
      searchText: '',
      from: '',
      to: '',
      sortBy: sortBy,
      sortDirection: sortDir,
      page: 1, // Reset to first page
      pageSize: pageSize,
    };
    setIsLoading(true);
    void searchVulnerabilities(vulnerabilitySearch).finally(() => {
      setIsLoading(false);
    });
  };

  // Apply filters from URL parameters
  useEffect(() => {
    const categoryParam = searchParams.get('category');
    const severityParam = searchParams.get('severity');
    const companyParam = searchParams.get('company');
    const protocolParam = searchParams.get('protocol');
    const sourceParam = searchParams.get('source');
    const pageParam = searchParams.get('page');
    const pageSizeParam = searchParams.get('pageSize');

    let hasFilters = false;

    // Set pagination from URL
    if (pageSizeParam) {
      const size = parseInt(pageSizeParam, 10);
      if ([10, 20, 50, 100].includes(size)) {
        setPageSize(size);
        setItemsPerPage(size);
      }
    }

    if (pageParam) {
      const page = parseInt(pageParam, 10);
      if (page > 0) {
        setCurrentPage(page);
        setPage(page);
        callSearch();
      }
    }

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
      setCurrentPage(1); // Reset to first page when filters are applied from URL
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
          setCurrentPage(1); // Reset to first page before searching
          callSearch();
        }, 100);
        return () => clearTimeout(timer);
      }
    }
  }, [categoriesList, severitiesList, protocolsList, sourceList, searchParams]);

  // Ensure current page is valid after filtering
  useEffect(() => {
    const maxPage = Math.ceil(totalItems / pageSize);
    if (totalItems > 0 && currentPage > maxPage) {
      const newPage = Math.max(1, maxPage);
      setCurrentPage(newPage);
      setPage(newPage);
    }
  }, [totalItems, pageSize, currentPage]);

  // Update URL when pagination changes
  useEffect(() => {
    const params = new URLSearchParams(searchParams);
    if (currentPage > 1) {
      params.set('page', currentPage.toString());
    } else {
      params.delete('page');
    }
    if (pageSize !== 10) {
      params.set('pageSize', pageSize.toString());
    } else {
      params.delete('pageSize');
    }

    const newUrl = `${window.location.pathname}${params.toString() ? '?' + params.toString() : ''}`;
    window.history.replaceState({}, '', newUrl);
  }, [currentPage, pageSize, searchParams]);

  // Handle browser navigation (back/forward buttons)
  useEffect(() => {
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search);
      const pageParam = params.get('page');
      const pageSizeParam = params.get('pageSize');

      if (pageParam) {
        const page = parseInt(pageParam, 10);
        if (page > 0 && page !== currentPage) {
          setCurrentPage(page);
          setPage(page);
        }
      }

      if (pageSizeParam) {
        const size = parseInt(pageSizeParam, 10);
        if ([5, 10, 20, 50].includes(size) && size !== pageSize) {
          setPageSize(size);
          setItemsPerPage(size);
        }
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [currentPage, pageSize]);

  const callSearch = (overrides?: Partial<{
    severities: VulnerabilitySeverity[];
    categories: CategoryItem[];
    companies: CompanyItem[];
    protocols: ProtocolItem[];
    auditors: AuditorItem[];
    sources: VulnerabilitySource[];
    searchText: string;
    from: string;
    to: string;
  }>) => {
    setIsLoading(true);
    const vulnerabilitySearch: VulnerabilitySearch = {
      severities: (overrides?.severities ?? severities).map(s => s.name),
      categories: (overrides?.categories ?? categories).map(c => c.name),
      companies: (overrides?.companies ?? companies).map(c => c.name),
      protocols: (overrides?.protocols ?? protocols).map(p => p.name),
      auditors: (overrides?.auditors ?? auditors).map(a => a.name),
      reports: (overrides?.sources ?? sources).map(s => s.name),
      searchText: overrides?.searchText ?? search,
      from: overrides?.from ?? (startDate?.toISOString().split('T')[0] || ''),
      to: overrides?.to ?? (endDate?.toISOString().split('T')[0] || ''),
      sortBy: sortBy,
      sortDirection: sortDir,
      page: currentPageRef.current,
      pageSize: pageSize,
    };
    setIsLoading(true);
    if (selectedVulnerability !== null) {
      setSelectedVulnerability(null);
    }
    void searchVulnerabilities(vulnerabilitySearch).finally(() => {
      setIsLoading(false);
    });
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Box sx={{ padding: '24px' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          {canAddVulnerability(auth) && (
            <Button
              variant="contained"
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
            onKeyDown={e => {
              if (e.key === 'Enter') {
                callSearch();
              }
            }}
            placeholder="Search"
            sx={{ width: '100%', maxWidth: 930 }}
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
              bgcolor: showFilters ? 'inherit' : 'transparent',
              color: showFilters ? 'white' : 'inherit',
              '&:hover': {
                // bgcolor: showFilters ? 'primary.dark' : 'action.hover'
                borderColor: showFilters ? 'primary.main' : 'divider'
              }
            }}
          >
            <FilterListIcon />
          </IconButton>
          <Button
            variant="contained"
            disabled={isLoading}
            onClick={() => {
              setCurrentPage(1); // Reset to first page when searching
              callSearch();
            }}
          >
            {isLoading ? (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <CircularProgress size={16} color="inherit" />
                Searching...
              </Box>
            ) : (
              'Search'
            )}
          </Button>
          <Button
            variant="contained"
            disabled={isLoading}
            onClick={() => {
              clearAllFilters();
              callSearch({
                severities: [],
                categories: [],
                companies: [],
                protocols: [],
                auditors: [],
                sources: [],
                searchText: '',
                from: '',
                to: ''
              });
            }}
          >
            Clear Filters
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
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2, px: 3 }}>
        <Typography variant="h3" sx={{ fontWeight: 600, color: themeMode === 'light' ? '#1A1A1A' : '#F2F2F2' }}>
          ENGAGE
        </Typography>
        {!isLoading && vulnerabilitiesList.length > 0 && (
          <Typography variant="body2" color="text.secondary">
            Page {currentPage} of {Math.ceil(totalItems / pageSize)}
          </Typography>
        )}
      </Box>
      {/* Vulnerabilities List Section */}
      <Box sx={{ pl: 3, pr: 3, display: 'flex', flexDirection: 'column' }}>
        <Box sx={{ display: 'flex', flexDirection: 'row', height: '70vh'}}>
        {/* Vulnerability cards */}
        <Stack spacing={3} sx={{
          width: selectedVulnerability ? ( isOnSmallScreen ? '100%' : '50%') : '100%',
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
          {isLoading && (
            <Grid size={12}>
              <Box sx={{ textAlign: 'center', mt: 6, py: 4 }}>
                <Typography variant="h6" color="text.secondary">
                  Loading vulnerabilities...
                </Typography>
              </Box>
            </Grid>
          )}
          {!isLoading && vulnerabilitiesList.length === 0 && (
            <Grid size={12}>
              <Box sx={{ textAlign: 'center', mt: 6, py: 4 }}>
                <Typography variant="h6" color="text.secondary" sx={{ mb: 1 }}>
                  {currentPage > 1 ? 'No more vulnerabilities on this page' : 'No vulnerabilities found'}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  {currentPage > 1
                    ? 'Try going back to the first page or adjusting your search criteria.'
                    : 'Try adjusting your search criteria or filters to find more results.'
                  }
                </Typography>
                {currentPage > 1 && (
                  <Button
                    variant="outlined"
                    color="primary"
                    onClick={() => {
                      setCurrentPage(1);
                      setPage(1);
                    }}
                  >
                    Go to First Page
                  </Button>
                )}
              </Box>
            </Grid>
          )}
          {!isLoading && vulnerabilitiesList.map(vuln => (
            <Box key={vuln.id}>
              <Card
                sx={{
                  mr: 1,
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
                    <Chip label={vuln.protocolName} size="small" sx={{ bgcolor: '#7b1fa2', color: '#F2F2F2' }} />
                  </Stack>
                </CardContent>
              </Card>
              </Box>
          ))}
        </Stack>
        {/* Vulnerability Profile Section */}
        {selectedVulnerability && (
          <VulnerabilityCard
            selectedVulnerability={selectedVulnerability}
            reportsList={reportsList}
            protocolsList={protocolsList}
            handleCloseProfile={handleCloseProfile}
            handleChipClick={handleChipClick}
            handleDownloadReport={handleDownloadReport}
            isModal={isOnSmallScreen} />
        )}
        </Box>

        {/* Pagination Controls */}
        {!isLoading && vulnerabilitiesList.length > 0 && totalItems > pageSize && (
          <Box sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            mt: 3,
            px: 2,
            flexWrap: 'wrap',
            gap: 2
          }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Typography variant="body2" color="text.secondary">
                {`${(currentPage - 1) * pageSize + 1}-${Math.min(currentPage * pageSize, totalItems)} of ${totalItems}`}
              </Typography>
              <FormControl size="small" sx={{ minWidth: 120 }}>
                <InputLabel>Items per page</InputLabel>
                <Select
                  value={pageSize}
                  label="Items per page"
                  onChange={handlePageSizeChange}
                >
                  <MenuItem value={10}>10</MenuItem>
                  <MenuItem value={20}>20</MenuItem>
                  <MenuItem value={50}>50</MenuItem>
                  <MenuItem value={100}>100</MenuItem>
                </Select>
              </FormControl>
            </Box>

            <Pagination
              count={Math.ceil(totalItems / pageSize)}
              page={currentPage}
              onChange={handlePageChange}
              color="primary"
              showFirstButton
              showLastButton
              size="medium"
              sx={{
                '& .MuiPaginationItem-root': {
                  color: themeMode === 'light' ? '#1A1A1A' : '#F2F2F2',
                  '&.Mui-selected': {
                    backgroundColor: '#1976d2',
                    color: '#ffffff',
                  },
                  '&:hover': {
                    backgroundColor: 'rgba(25, 118, 210, 0.08)',
                  },
                },
              }}
            />
          </Box>
        )}

        {/* Total count display for single page */}
        {!isLoading && vulnerabilitiesList.length > 0 && totalItems <= pageSize && (
          <Box sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            mt: 3,
            px: 2
          }}>
            <Typography variant="body2" color="text.secondary">
              {`${totalItems} vulnerabilit${totalItems !== 1 ? 'ies' : 'y'} found`}
            </Typography>
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel>Items per page</InputLabel>
              <Select
                value={pageSize}
                label="Items per page"
                onChange={handlePageSizeChange}
              >
                <MenuItem value={10}>10</MenuItem>
                <MenuItem value={20}>20</MenuItem>
                <MenuItem value={50}>50</MenuItem>
                <MenuItem value={100}>100</MenuItem>
              </Select>
            </FormControl>
          </Box>
        )}
      </Box>
    </LocalizationProvider>
  );
};
