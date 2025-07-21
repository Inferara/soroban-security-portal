import { FC, useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  CardActions,
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
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
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
import { useEffect } from 'react';
import { ProjectItem } from '../../../../api/soroban-security-portal/models/project';
import { AuditorItem } from '../../../../api/soroban-security-portal/models/auditor';
import { CategoryItem } from '../../../../api/soroban-security-portal/models/category';
import { environment } from '../../../../environments/environment';
import { CodeBlock } from '../../../../components/CodeBlock';

export const Vulnerabilities: FC = () => {
  // Filter/search state
  const [search, setSearch] = useState('');
  const { themeMode } = useTheme();
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [severities, setSeverities] = useState<VulnerabilitySeverity[]>([]);
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [auditors, setAuditors] = useState<AuditorItem[]>([]);
  const [sources, setSources] = useState<VulnerabilitySource[]>([]);
  const [sortBy] = useState<'date' | 'severity'>('date');
  const [sortDir, setSortDir] = useState<'desc' | 'asc'>('desc');
  const [showFilters, setShowFilters] = useState(false);
  const [collapsedDescriptions, setCollapsedDescriptions] = useState<Set<string>>(new Set());

  const { severitiesList, categoriesList, projectsList, auditorsList, sourceList, vulnerabilitiesList, searchVulnerabilities, reportsList } = useVulnerabilities();
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

  const toggleDescriptionCollapse = (id: string) => {
    setCollapsedDescriptions(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const getDescriptionLines = (description: string) => {
    return description.split('\n');
  };

  const shouldShowCollapse = (description: string) => {
    const lines = getDescriptionLines(description);
    return lines.length > 10;
  };

  const getTruncatedDescription = (description: string) => {
    const lines = getDescriptionLines(description);
    if (lines.length <= 10) {
      return description;
    }
    return lines.slice(0, 10).join('\n');
  };

  const callSearch = () => {
    const vulnerabilitySearch: VulnerabilitySearch = {
      severities: severities.map(s => s.name),
      categories: categories.map(c => c.name),
      projects: projects.map(p => p.name),
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

  useEffect(() => {
    setCollapsedDescriptions(new Set(vulnerabilitiesList.map(vuln => vuln.id.toString())));
  }, [vulnerabilitiesList]);

  // Apply filters from URL parameters
  useEffect(() => {
    const categoryParam = searchParams.get('category');
    const severityParam = searchParams.get('severity');
    const projectParam = searchParams.get('project');
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

    if (projectParam && projectsList.length > 0) {
      const project = projectsList.find(p => p.name === projectParam);
      if (project) {
        setProjects([project]);
        hasFilters = true;
        console.log('Applied project filter from URL:', projectParam);
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
  }, [searchParams, categoriesList, severitiesList, projectsList, sourceList]);

  // Auto-search when filters are applied from URL
  useEffect(() => {
    if (categoriesList.length > 0 && severitiesList.length > 0 && projectsList.length > 0 && sourceList.length > 0) {
      const hasUrlFilters = searchParams.get('category') || searchParams.get('severity') || searchParams.get('project') || searchParams.get('source');
      if (hasUrlFilters) {
        console.log('Auto-searching with URL filters:', {
          category: searchParams.get('category'),
          severity: searchParams.get('severity'),
          project: searchParams.get('project'),
          source: searchParams.get('source')
        });
        // Small delay to ensure all filter lists are loaded
        const timer = setTimeout(() => {
          callSearch();
        }, 100);
        return () => clearTimeout(timer);
      }
    }
  }, [categoriesList, severitiesList, projectsList, sourceList, searchParams]);

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Box>
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
            sx={{ minWidth: 800 }}
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
                sx: { minWidth: 200, backgroundColor: themeMode === 'light' ? '#fafafa' : 'background.paper' }
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
                sx: { minWidth: 200, backgroundColor: themeMode === 'light' ? '#fafafa' : 'background.paper' }
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
          <Box sx={{ mb: 3, display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center' }}>
            {showFilters && (
              <>
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
                      sx={{ minWidth: 290 }}
                    />
                  )}
                  renderValue={(selected) => (
                    (selected as VulnerabilitySeverity[]).map((option, index) => (
                      <Chip
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
                              case 'Info': return '#72F1FF95';
                              default: return '#e0e0e0';
                            }
                          })(),
                          color: '#F2F2F2',
                          fontWeight: 700,
                        }}
                      />
                    ))
                  )}
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
                      sx={{ minWidth: 290 }}
                    />
                  )}
                  renderValue={(selected) =>
                    (selected as CategoryItem[]).map((option, index) => (
                      <Chip
                        key={index}
                        label={option.name}
                        size="small"
                        sx={{
                          bgcolor: option.bgColor,
                          color: option.textColor,
                          fontWeight: 700,
                        }}
                      />
                    ))
                  }
                />
                <Autocomplete
                  multiple
                  options={projectsList}
                  value={projects}
                  onChange={(_, newValue) => setProjects(newValue as ProjectItem[])}
                  getOptionLabel={(option) => (option as ProjectItem).name}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Project"
                      size="small"
                      sx={{ minWidth: 290 }}
                    />
                  )}
                  renderValue={(selected) =>
                    (selected as ProjectItem[]).map((option, index) => (
                      <Chip
                        key={index}
                        label={option.name}
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
                      sx={{ minWidth: 290 }}
                    />
                  )}
                  renderValue={(selected) =>
                    (selected as AuditorItem[]).map((option, index) => (
                      <Chip
                        key={index}
                        label={option.name}
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
                      label="Source"
                      size="small"
                      sx={{ minWidth: 290 }}
                    />
                  )}
                  renderValue={(selected) =>
                    (selected as VulnerabilitySource[]).map((option, index) => (
                      <Chip
                        key={index}
                        label={option.name}
                        size="small"
                        sx={{ bgcolor: '#0288d1', color: '#F2F2F2' }}
                      />
                    ))
                  }
                />
              </>
            )}
          </Box>
        </Box>
      {/* Vulnerability cards */}
      <Grid container spacing={3}>
        <Typography variant="h3" sx={{ fontWeight: 600, mb: 1, color: themeMode === 'light' ? '#1A1A1A' : '#F2F2F2' }}>ENGAGE</Typography>
        {vulnerabilitiesList.length === 0 && (
          <Grid size={12}>
            <Typography color="text.secondary" sx={{ textAlign: 'center', mt: 6 }}>
              No vulnerabilities found for the selected filters.
            </Typography>
          </Grid>
        )}
        {vulnerabilitiesList.map(vuln => (
          <Grid size={12} key={vuln.id}>
            <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column', borderRadius: '20px', 
              border: '1px solid',
              backgroundColor: themeMode === 'light' ? '#fafafa' : '#1A1A1A',
              borderLeft: `10px solid ${
              vuln.severity === 'Critical' ? '#c72e2b95' :
              vuln.severity === 'High' ? '#FF6B3D95' :
              vuln.severity === 'Medium' ? '#FFD84D95' :
              vuln.severity === 'Low' ? '#569E6795' :
              vuln.severity === 'Info' ? '#72F1FF95' :
              '#388e3c'}` }}>
              <CardContent sx={{ flexGrow: 1 }}>
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                  <Typography variant="h6" sx={{ fontWeight: 600, flexGrow: 1 }}>
                    {vuln.title}
                  </Typography>
                </Stack>
                <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
                  {vuln.categories.map((category, index) => (
                    <Chip key={`${vuln.id}-category-${index}`} label={category} size="small" sx={{ bgcolor: getCategory(category)?.bgColor, color: getCategory(category)?.textColor }} />
                  ))}
                  <Chip label={vuln.project} size="small" sx={{ bgcolor: '#7b1fa2', color: '#F2F2F2' }} />
                  <Chip label={vuln.auditor} size="small" sx={{ bgcolor: '#0918d1', color: '#F2F2F2' }} />
                  <Chip label={vuln.source} size="small" sx={{ bgcolor: '#0288d1', color: '#F2F2F2' }} />
                </Stack>
                <ReactMarkdown
                  skipHtml={false}
                  remarkPlugins={[remarkParse, remarkGfm, remarkMath, remarkRehype]}
                  rehypePlugins={[rehypeRaw]}
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
                    }
                  }}
                >
                  {collapsedDescriptions.has(vuln.id.toString()) ? getTruncatedDescription(vuln.description) : vuln.description}
                </ReactMarkdown>
                {shouldShowCollapse(vuln.description) && (
                  <Box sx={{ mt: 1, display: 'flex', alignItems: 'center' }}>
                    <IconButton
                      onClick={() => toggleDescriptionCollapse(vuln.id.toString())}
                      sx={{ color: themeMode === 'light' ? 'text.secondary' : 'text.disabled' }}
                    >
                      {collapsedDescriptions.has(vuln.id.toString()) ? <ExpandMoreIcon /> : <ExpandLessIcon />}
                    </IconButton>
                    <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                      {collapsedDescriptions.has(vuln.id.toString()) ? 'Show more' : 'Show less'}
                    </Typography>
                  </Box>
                )}
                <Typography variant="caption" color="text.secondary">
                  Discovered: {new Date(vuln.date).toLocaleDateString()}
                </Typography>
              </CardContent>
              <CardActions sx={{ justifyContent: 'flex-end' }}>
                {vuln.source === 'External' ? (
                  <MuiLink
                    href={vuln.reportUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    sx={{ textDecoration: 'none' }}
                  >
                    <Button
                      variant="outlined"
                      size="small"
                      sx={{ textTransform: 'none', marginRight: '20px' }}
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
                      >
                        <Button
                          variant="outlined"
                          size="small"
                          sx={{ textTransform: 'none', marginRight: '20px' }}
                        >
                          View Report
                        </Button>
                      </MuiLink>
                    );
                  }
                  return (
                    <Typography variant="caption" color="text.disabled" sx={{ marginRight: '20px' }}>
                      No report available
                    </Typography>
                  );
                })()}
              </CardActions>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
    </LocalizationProvider>
  );
};
