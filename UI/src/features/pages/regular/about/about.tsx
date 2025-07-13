import { FC } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

export const About: FC = () => {
  return (
    <Box sx={{ bgcolor: 'background.paper', boxShadow: 0, p: 3, minHeight: '80vh' }}>
      <Typography variant="h4" component="h2" sx={{ mb: 3, color: 'text.primary' }}>
        About Soroban Security Portal
      </Typography>

      {/* <Typography variant="h5" component="h3" sx={{ mb: 2, color: 'text.primary' }}>
        Our Mission
      </Typography>
      <Typography variant="body1" sx={{ mb: 3, color: 'text.primary' }}>
        The Soroban Security Portal is dedicated to fostering a secure ecosystem for smart contract development on the Soroban platform. We provide comprehensive security resources, audit services, and tools to help developers build robust and secure applications.
      </Typography>

      <Typography variant="h5" component="h3" sx={{ mb: 2, color: 'text.primary' }}>
        What We Offer
      </Typography>
      <Typography variant="body1" sx={{ mb: 2, color: 'text.primary' }}>
        • <strong>Security Audits:</strong> Professional smart contract security audits conducted by experienced teams
      </Typography>
      <Typography variant="body1" sx={{ mb: 2, color: 'text.primary' }}>
        • <strong>Vulnerability Database:</strong> Comprehensive collection of known vulnerabilities and security issues
      </Typography>
      <Typography variant="body1" sx={{ mb: 2, color: 'text.primary' }}>
        • <strong>Security Reports:</strong> Detailed reports and analysis of security findings
      </Typography>
      <Typography variant="body1" sx={{ mb: 2, color: 'text.primary' }}>
        • <strong>Best Practices:</strong> Guidelines and recommendations for secure smart contract development
      </Typography>
      <Typography variant="body1" sx={{ mb: 3, color: 'text.primary' }}>
        • <strong>Community Support:</strong> Access to security experts and the broader Soroban community
      </Typography>

      <Typography variant="h5" component="h3" sx={{ mb: 2, color: 'text.primary' }}>
        Contact Information
      </Typography>
      <Typography variant="body1" sx={{ mb: 3, color: 'text.primary' }}>
        For more information about our services or to request a security audit, please contact our team through the appropriate channels.
      </Typography> */}
    </Box>
  );
}; 