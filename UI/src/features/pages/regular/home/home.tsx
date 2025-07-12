import { FC } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import { useNavigate } from 'react-router-dom';
import { GalaxyCanvas } from './galaxy-canvas';
import { VulnerabilityPieChart } from './vulnerability-pie-chart';

export const Home: FC = () => {
  const navigate = useNavigate();

  const handleGetStarted = () => {
    navigate('/login');
  };

  const handleLearnMore = () => {
    navigate('/about');
  };

  return (
    <Box sx={{ position: 'relative', minHeight: '80vh', overflow: 'hidden' }}>
      {/* Content Overlay */}
      <Box 
        sx={{ 
          position: 'relative', 
          zIndex: 1, 
          p: 3, 
          minHeight: '80vh',
          backdropFilter: 'blur(2px)',
        }}
      >
        <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}>          
          {/* Background */}
          <GalaxyCanvas />
        </div>
        <Typography variant="h2" component="h2" 
          sx={{ 
            mb: 3, 
            color: 'black', 
            textAlign: 'center', 
            paddingTop: '200px',
            textShadow: `
              -1px -1px 0 #DDCDB1,
               1px -1px 0 #DDCDB1,
              -1px  1px 0 #DDCDB1,
               1px  1px 0 #DDCDB1,
              -2px -2px 0 #DDCDB1,
               2px -2px 0 #DDCDB1,
              -2px  2px 0 #DDCDB1,
               2px  2px 0 #DDCDB1
            `,
            fontWeight: 'bold'
          }}>
          WELCOME TO SOROBAN<br />SECURITY PORTAL
        </Typography>

        <Typography variant="h6" component="h3" 
          sx={{ 
            mb: 4, 
            textAlign: 'center', 
            color: '#DDCDB1',
          }}>
          It's your go-to hub for all things secure in the world of Soroban - Soroban's<br />
          smart contract platform. Think of it as your safety compass: audit history,<br />
          tools, tips and top-tier experts who've put Soroban projects through their<br />
          paces.
        </Typography>

        {/* Action Buttons */}
        <Box sx={{ 
          display: 'flex', 
          justifyContent: 'center', 
          gap: 3, 
          flexWrap: 'wrap',
          mt: 4 
        }}>
          <Button
            variant="contained"
            onClick={handleGetStarted}
            sx={{
              backgroundColor: '#4f8cff',
              color: 'white',
              px: 4,
              py: 1.5,
              fontSize: '1.1rem',
              fontWeight: 900,
              textTransform: 'none',
              borderRadius: '8px',
              boxShadow: '0 4px 12px rgba(79, 140, 255, 0.3)',
              '&:hover': {
                backgroundColor: '#3358e6',
                boxShadow: '0 6px 16px rgba(79, 140, 255, 0.4)',
              },
            }}
          >
            Get Started
          </Button>
          
          <Button
            variant="outlined"
            onClick={handleLearnMore}
            sx={{
              color: '#1A1A1A',
              borderColor: '#fafafa',
              backgroundColor: '#fafafa',
              px: 4,
              py: 1.5,
              fontSize: '1.1rem',
              fontWeight: 900,
              textTransform: 'none',
              borderRadius: '8px',
              '&:hover': {
                backgroundColor: 'rgba(250, 250, 250, 0.1)',
                borderColor: '#fafafa',
              },
            }}
          >
            Learn More
          </Button>
        </Box>
        
        {/* Vulnerability Statistics Pie Chart */}
        <Box sx={{ 
          display: 'flex', 
          justifyContent: 'center', 
          mt: 6,
          mb: 4
        }}>
          <VulnerabilityPieChart 
            height={350}
            width={350}
          />
        </Box>
      </Box>
    </Box>
  );
};
