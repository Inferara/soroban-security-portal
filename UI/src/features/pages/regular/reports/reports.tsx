import { FC, useState } from 'react';
import { Box, Card, CardContent, CardMedia, Typography, Grid, Button, TextField, InputAdornment, IconButton, Autocomplete, Chip } from '@mui/material';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { Search as SearchIcon } from '@mui/icons-material';
import { AuthContextProps, useAuth } from 'react-oidc-context';
import { useNavigate } from 'react-router-dom';
import { Role } from '../../../../api/soroban-security-portal/models/role';
import { useReports } from './hooks';
import { environment } from '../../../../environments/environment';
import SwapVertIcon from '@mui/icons-material/SwapVert';
import { useTheme } from '../../../../contexts/ThemeContext';
import { AuditorItem } from '../../../../api/soroban-security-portal/models/auditor';
import { ProjectItem } from '../../../../api/soroban-security-portal/models/project';

export const Reports: FC = () => {
  const { themeMode } = useTheme();
  const { reportsList, searchReports, auditorsList, projectsList } = useReports();
  const auth = useAuth();
  const navigate = useNavigate();
  const [searchText, setSearchText] = useState('');
  const [auditor, setAuditor] = useState<AuditorItem | null>(null);
  const [project, setProject] = useState<ProjectItem | null>(null);
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [sortDir, setSortDir] = useState<'desc' | 'asc'>('desc');
  const canAddReport = (auth: AuthContextProps) => 
    auth.user?.profile.role === Role.Admin || auth.user?.profile.role === Role.Contributor || auth.user?.profile.role === Role.Moderator;
  
  const toggleSortDirection = () => {
    setSortDir(prev => prev === 'desc' ? 'asc' : 'desc');
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Box>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          {canAddReport(auth) && (
            <Button
              variant="contained"
              color="primary"
              sx={{ fontWeight: 600, borderRadius: 2 }}
              onClick={() => navigate('/reports/add')}
            >
              Add Report
            </Button>
          )}
        </Box>
        <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap', alignItems: 'center' }}>
          <TextField
            size="small"
            value={searchText}
            onChange={e => setSearchText(e.target.value)}
            placeholder="Search"
            sx={{ minWidth: 500 }}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <SearchIcon />
                </InputAdornment>
              ),
            }}
          />
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
            color="primary"
            sx={{ fontWeight: 600, borderRadius: 2, height: 40, alignSelf: 'flex-end' }}
            onClick={() => searchReports(
              { 
                searchText, 
                project: project?.name || '',
                auditor: auditor?.name || '',
                from: startDate?.toISOString().split('T')[0] || '', 
                to: endDate?.toISOString().split('T')[0] || '',              
                sortBy: 'date',
                sortDirection: sortDir,
              })}
          >
            Search
          </Button>
        </Box>
        <Typography variant="h3" sx={{ fontWeight: 600, mb: 1, color: themeMode === 'light' ? '#1A1A1A' : '#F2F2F2' }}>REPORTS</Typography>
        <Grid container spacing={3}>
          {reportsList.map((report) => (
            <Grid size={4} key={report.id}>
              <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column', paddingTop: '10px', borderRadius: '20px', 
                backgroundColor: themeMode === 'light' ? '#fafafa' : '#1A1A1A', 
                border: '1px solid' }}>
                {report.image ? (
                  <CardMedia
                    component="img"
                    sx={{ 
                      objectFit: 'cover',
                      objectPosition: 'top',
                      height: '440px',
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
                    image={`data:image/jpeg;base64,${report.image}`}
                    alt={report.name}
                    title="Hover to see full image"
                  />
                ) : (
                  <Box sx={{ height: 540, bgcolor: '#f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Typography variant="subtitle2" color="text.secondary">
                      No Image
                    </Typography>
                  </Box>
                )}
                <CardContent sx={{ flexGrow: 1 }}>
                  <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
                    {report.name}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    Published: {new Date(report.date).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                  </Typography>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                    For: {report.project}
                  </Typography>
                  <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                    By: {report.auditor}
                  </Typography>
                  <div style={{ display: 'flex', justifyContent: 'end', alignItems: 'end', marginRight: '20px' }}>
                    <Button
                      variant="outlined"
                      href={`${environment.aiCoreApiUrl}/api/v1/reports/${report.id}/download`}
                      target="_blank"
                      rel="noopener"
                      sx={{ 
                        fontWeight: 600, 
                        borderRadius: 2, 
                        backgroundColor: themeMode === 'light' ? '#1A1A1A' : '#fafafa', 
                        color: themeMode === 'light' ? '#fafafa' : '#1A1A1A'
                      }}
                    >
                      Download Report
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Box>
    </LocalizationProvider>
  );
};
