import { FC, useEffect, useState } from 'react';
import React from 'react';
import { Box, Card, CardContent, CardMedia, Typography, Button, TextField, InputAdornment, IconButton, Autocomplete, Chip, CircularProgress, Tooltip, Link as MuiLink } from '@mui/material';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { Search as SearchIcon } from '@mui/icons-material';
import { AuthContextProps, useAuth } from 'react-oidc-context';
import { useNavigate } from 'react-router-dom';
import { isAuthorized, Role } from '../../../../api/soroban-security-portal/models/role';
import { useReports } from './hooks';
import { environment } from '../../../../environments/environment';
import SwapVertIcon from '@mui/icons-material/SwapVert';
import { useTheme } from '../../../../contexts/ThemeContext';
import { AuditorItem } from '../../../../api/soroban-security-portal/models/auditor';
import { ProtocolItem } from '../../../../api/soroban-security-portal/models/protocol';
import { CompanyItem } from '../../../../api/soroban-security-portal/models/company';
import { showMessage } from '../../../dialog-handler/dialog-handler';
import ReactGA from 'react-ga4';

export const Reports: FC = () => {
  const { themeMode } = useTheme();
  const { reportsList, searchReports, auditorsList, protocolsList, companiesList } = useReports();
  const auth = useAuth();
  const navigate = useNavigate();
  const [searchText, setSearchText] = useState('');
  const [auditor, setAuditor] = useState<AuditorItem | null>(null);
  const [protocol, setProtocol] = useState<ProtocolItem | null>(null);
  const [company, setCompany] = useState<CompanyItem | null>(null);
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [sortDir, setSortDir] = useState<'desc' | 'asc'>('desc');
  const [loadingImages, setLoadingImages] = useState<{ [key: number]: boolean }>({});

  const canAddReport = (auth: AuthContextProps) =>
    auth.user?.profile.role === Role.Admin || auth.user?.profile.role === Role.Contributor || auth.user?.profile.role === Role.Moderator;

  const canDownloadReport = (auth: AuthContextProps) => isAuthorized(auth);

  useEffect(() => {
    ReactGA.send({ hitType: "pageview", page: "/reports", title: "Reports Page" });
  }, [])

  const toggleSortDirection = () => {
    setSortDir(prev => prev === 'desc' ? 'asc' : 'desc');
  };

  const handleImageLoad = (reportId: number) => {
    setLoadingImages(prev => ({ ...prev, [reportId]: false }));
  };

  const handleImageError = (reportId: number) => {
    setLoadingImages(prev => ({ ...prev, [reportId]: false }));
  };

  const startImageLoading = (reportId: number) => {
    setLoadingImages(prev => ({ ...prev, [reportId]: true }));
  };

  const handleReportDownload = (reportId: number) => {
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

  // Initialize loading state for all reports
  React.useEffect(() => {
    const initialLoadingState: { [key: number]: boolean } = {};
    reportsList.forEach(report => {
      // Only set to loading if not already in the state
      if (!(report.id in loadingImages)) {
        initialLoadingState[report.id] = true;
      }
    });
    setLoadingImages(prev => ({ ...prev, ...initialLoadingState }));
  }, [reportsList]);

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Box sx={{ padding: '24px' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          {canAddReport(auth) && (
            <Button
              variant="contained"
              onClick={() => navigate('/reports/add')}
            >
              Add Report
            </Button>
          )}
        </Box>
        <Box sx={{ mb: 3, display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
          <TextField
            size="small"
            value={searchText}
            onChange={e => setSearchText(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                searchReports({
                  searchText,
                  protocolName: protocol?.name || '',
                  companyName: company?.name || '',
                  auditorName: auditor?.name || '',
                  from: startDate?.toISOString().split('T')[0] || '',
                  to: endDate?.toISOString().split('T')[0] || '',
                  sortBy: 'date',
                  sortDirection: sortDir,
                });
              }
            }}
            placeholder="Search"
            sx={{ minWidth: { xs: 290, sm: 340, md: 400, lg: 500 } }}
            slotProps={{
              input: {
                endAdornment: (
                  <InputAdornment position="end">
                    <SearchIcon />
                  </InputAdornment>
                ),
              },
            }}
          />
          <Autocomplete
            options={companiesList}
            value={company}
            onChange={(_, newValue) => setCompany(newValue as CompanyItem)}
            getOptionLabel={(option) => (option as CompanyItem).name}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Company"
                size="small"
                sx={{ minWidth: 290 }}
              />
            )}
            renderValue={(selected) =>
              selected ? (
                <Chip
                  label={(selected as CompanyItem).name}
                  size="small"
                  sx={{ bgcolor: '#2b7fa2', color: '#F2F2F2' }}
                />
              ) : null
            }
          />
          <Autocomplete
            options={protocolsList}
            value={protocol}
            onChange={(_, newValue) => setProtocol(newValue as ProtocolItem)}
            getOptionLabel={(option) => (option as ProtocolItem).name}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Protocol"
                size="small"
                sx={{ minWidth: 290 }}
              />
            )}
            renderValue={(selected) =>
              selected ? (
                <Chip
                  label={(selected as ProtocolItem).name}
                  size="small"
                  sx={{ bgcolor: '#7b1fa2', color: '#F2F2F2' }}
                />
              ) : null
            }
          />
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
            renderValue={(selected) =>
              selected ? (
                <Chip
                  label={(selected as AuditorItem).name}
                  size="small"
                  sx={{ bgcolor: '#0918d1', color: '#F2F2F2' }}
                />
              ) : null
            }
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
          <Button
            variant="contained"
            onClick={() => searchReports(
              {
                searchText,
                protocolName: protocol?.name || '',
                companyName: company?.name || '',
                auditorName: auditor?.name || '',
                from: startDate?.toISOString().split('T')[0] || '',
                to: endDate?.toISOString().split('T')[0] || '',
                sortBy: 'date',
                sortDirection: sortDir,
              })}
          >
            Search
          </Button>
        </Box>
      </Box>
        <Typography variant="h3" sx={{ fontWeight: 600, pl: 3, pb: 3, mb: 1, color: themeMode === 'light' ? '#1A1A1A' : '#F2F2F2' }}>REPORTS</Typography>
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
            gap: 3,
            pl: 3,
            pb: 3,
          }}
        >
          {reportsList.map((report) => (
            <Card 
              key={report.id}
              sx={{
                height: '100%', display: 'flex', flexDirection: 'column', paddingTop: '0px', borderRadius: '20px',
                backgroundColor: themeMode === 'light' ? '#fafafa' : '#1A1A1A',
                border: '1px solid', position: 'relative'
              }}>
              <CardMedia
                component="img"
                sx={{
                  objectFit: 'cover',
                  objectPosition: 'top',
                  height: '150px',
                  transition: 'all 0.3s ease-in-out',
                  cursor: 'pointer',
                  '&:hover': {
                    objectFit: 'contain',
                    objectPosition: 'center',
                    transform: 'scale(1.05)',
                    zIndex: 1000,
                    position: 'relative',
                    boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
                    borderRadius: '8px'
                  }
                }}
                height="540"
                image={`${environment.apiUrl}/api/v1/reports/${report.id}/image.png`}
                alt={report.name}
                title={report.name}
                onLoad={() => handleImageLoad(report.id)}
                onError={() => handleImageError(report.id)}
                onLoadStart={() => startImageLoading(report.id)}
              />
              {loadingImages[report.id] && (
                <Box sx={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}>
                  <CircularProgress size={40} sx={{ color: themeMode === 'light' ? '#1A1A1A' : '#fafafa' }} />
                </Box>
              )}
              <CardContent sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <Box>
                  <Tooltip title={report.name} placement="top">
                    <Typography variant="h6" sx={{ fontWeight: 600, mb: 1, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                      {report.name}
                    </Typography>
                  </Tooltip>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    Published:&nbsp;{new Date(report.date).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                  </Typography>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                    Company:&nbsp;{report.companyName}
                  </Typography>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                    Protocol:&nbsp;
                    <MuiLink
                      rel="noopener noreferrer"
                      style={{ cursor: 'pointer'}}
                      sx={{ textDecoration: 'none', flexShrink: 0, width: { xs: '100%', sm: 'auto' } }}
                      onClick={() => {
                        const protocol = protocolsList.find(p => p.name === report.protocolName);
                        if (protocol) navigate(`/protocol/${protocol.id}`);
                      }}
                    >
                      {report.protocolName}
                    </MuiLink>
                  </Typography>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                    Auditor:&nbsp;
                    <MuiLink
                      rel="noopener noreferrer"
                      style={{ cursor: 'pointer'}}
                      sx={{ textDecoration: 'none', flexShrink: 0, width: { xs: '100%', sm: 'auto' } }}
                      onClick={() => {
                        const auditor = auditorsList.find(a => a.name === report.auditorName);
                        if (auditor) navigate(`/auditor/${auditor.id}`);
                      }}
                    >
                      {report.auditorName}
                    </MuiLink>
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mt: 2 }}>
                  <Button
                    variant="contained"
                    onClick={() => navigate(`/report/${report.id}`)}
                  >
                    Details
                  </Button>
                  <Button
                    variant="contained"
                    onClick={() => handleReportDownload(report.id)}
                    // sx={{
                    //   fontWeight: 600,
                    //   borderRadius: 2,
                    //   backgroundColor: themeMode === 'light' ? '#1A1A1A' : '#fafafa',
                    //   color: themeMode === 'light' ? '#fafafa' : '#1A1A1A'
                    // }}
                  >
                    Download Report
                  </Button>
                </Box>
              </CardContent>
            </Card>
          ))}
        </Box>
    </LocalizationProvider>
  );
};
