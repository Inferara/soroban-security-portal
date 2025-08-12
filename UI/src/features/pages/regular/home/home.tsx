import { FC } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import { useNavigate } from 'react-router-dom';
import { GalaxyCanvas } from './galaxy-canvas';
import { VulnerabilityPieChart } from './vulnerability-pie-chart';
import { VulnerabilityTable } from './vulnerability-table';
import ReactGA from 'react-ga4';

export const Home: FC = () => {
  const navigate = useNavigate();

  const handleGetStarted = () => {
    navigate('/vulnerabilities');
    ReactGA.event({ category: "Vulnerability", action: "click", label: "Warp button click" });
  };

  const handleLearnMore = () => {
    navigate('/about');
    ReactGA.event({ category: "About", action: "click", label: "Learn More button click" });
  };

  return (
    <Box sx={{ position: 'relative', minHeight: '100vh', overflow: 'hidden', elevation: 0 }}>
      {/* Content Overlay */}
      <Box
        id="hero"
        sx={{
          position: 'relative',
          zIndex: 1,
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backdropFilter: 'blur(2px)',
          overflow: 'hidden',
        }}
      >
        {/* GalaxyCanvas only covers hero section */}
        <Box sx={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 2, pointerEvents: 'none' }}>
          <GalaxyCanvas />
        </Box>
        <Typography
          variant="h2"
          component="h2"
          sx={{
            mb: { xs: 2, md: 3 },
            color: 'black',
            textAlign: 'center',
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
            fontWeight: 'bold',
            position: 'relative',
            zIndex: 3,
            fontSize: 'clamp(3.75rem, 6vw, 7rem)',
          }}
        >
          WELCOME TO THE<br />SOROBAN SECURITY PORTAL
        </Typography>

        <Typography
          variant="h6"
          component="h3"
          sx={{
            mb: { xs: 3, md: 4 },
            textAlign: 'center',
            color: '#DDCDB1',
            position: 'relative',
            fontSize: 'clamp(1.5rem, 1.5vw, 2rem)',
            zIndex: 3,
          }}
        >
          It's your go-to hub for all things secure in the world of Soroban - Soroban's<br />
          smart contract platform. Think of it as your safety compass: audit history,<br />
          tools, tips and top-tier experts who've put Soroban projects through their<br />
          paces.
        </Typography>

        {/* Action Buttons */}
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'center',
            gap: 3,
            flexWrap: 'wrap',
            mt: { xs: 2, md: 4 },
            position: 'relative',
            zIndex: 3,
          }}
        >
            <Button
            variant="contained"
            onClick={handleGetStarted}
            sx={{
              color: 'white',
              px: 4,
              py: 1.5,
              fontSize: '1.1rem',
              fontWeight: 900,
              textTransform: 'uppercase',
              borderRadius: '8px',
              position: 'relative',
              overflow: 'hidden',
              '&::before': {
              content: '""',
              position: 'absolute',
              top: 0,
              left: '-150%',
              width: '200%',
              height: '100%',
              background: 'linear-gradient(120deg, rgba(255,255,255,0) 30%, rgba(255,255,255,0.5) 50%, rgba(255,255,255,0) 70%)',
              transform: 'skewX(-20deg)',
              animation: 'glitter 2s infinite',
              },
            }}
            >
            Warp
            </Button>

            <style>
            {`
              @keyframes glitter {
              0% {
                left: -150%;
              }
              50% {
                left: 150%;
              }
              100% {
                left: 150%;
              }
              }
            `}
            </style>

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
      </Box>

      {/* Vulnerability Statistics Pie Chart */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <div style={{ display: 'flex', gap: '20px', justifyContent: 'center', alignItems: 'center', flexDirection: 'column' }}>
          <div>
            <VulnerabilityPieChart
              height={350}
              width={350}
            />
          </div>
          <div style={{ paddingTop: '100px', paddingBottom: '100px' }}>
            <VulnerabilityTable />
          </div>
        </div>
      </Box>
    </Box>
  );
};
