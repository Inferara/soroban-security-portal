import { Box, Typography, Paper, Chip, Avatar } from '@mui/material';
import { FC } from 'react';
import VerifiedIcon from '@mui/icons-material/Verified';
import SecurityIcon from '@mui/icons-material/Security';
import BugReportIcon from '@mui/icons-material/BugReport';

export const BadgeDemoPage: FC = () => {
  return (
    <Box sx={{ p: 4 }}>
      <Typography variant="h4" gutterBottom>
        User Badges Demo
      </Typography>
      
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Profile Badges
        </Typography>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', mb: 2 }}>
          <Avatar sx={{ width: 64, height: 64 }}>U</Avatar>
          <Box>
            <Typography variant="h6">User Name</Typography>
            <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
              <Chip icon={<VerifiedIcon />} label="Verified" color="primary" size="small" />
              <Chip icon={<SecurityIcon />} label="Auditor" color="secondary" size="small" />
              <Chip icon={<BugReportIcon />} label="Bug Hunter" color="success" size="small" />
            </Box>
          </Box>
        </Box>
      </Paper>

      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>
          Comment Badges
        </Typography>
        <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
          <Avatar>A</Avatar>
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="subtitle2">Alice</Typography>
              <Chip label="Core Team" size="small" color="info" sx={{ height: 20, fontSize: '0.7rem' }} />
            </Box>
            <Typography variant="body2">This is a comment from a core team member.</Typography>
          </Box>
        </Box>
      </Paper>
    </Box>
  );
};
