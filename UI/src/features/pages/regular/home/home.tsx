import { FC } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import { useNavigate } from 'react-router-dom';
import { GalaxyCanvas } from './galaxy-canvas';
import { VulnerabilityPieChart } from './vulnerability-pie-chart';
import { VulnerabilityTable } from './vulnerability-table';
import ReactGA from 'react-ga4';
import { StatisticsChanges } from './statistics-changes';
import { useState, useEffect } from 'react';

export const Home: FC = () => {
  const navigate = useNavigate();
  const showTable = false;

  const handleGetStarted = () => {
    navigate('/vulnerabilities');
    ReactGA.event({ category: "Vulnerability", action: "click", label: "Warp button click" });
  };

  const handleLearnMore = () => {
    navigate('/about');
    ReactGA.event({ category: "About", action: "click", label: "Learn More button click" });
  };

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
            color: 'background.default',
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
            color: 'primary.contrastText',
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
                px: 4,
                py: 1.5,
                fontSize: '1.1rem',
                fontWeight: 900,
                textTransform: 'uppercase',
                position: 'relative',
                overflow: 'hidden',
                '&::before': {
                  content: '""',
                  position: 'absolute',
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
              color: 'background.default',
              borderColor: 'primary.main',
              backgroundColor: 'primary.main',
              px: 4,
              py: 1.5,
              textTransform: 'none',
              '&:hover': {
                backgroundColor: 'rgba(250, 250, 250, 0.1)',
                borderColor: 'primary.main',
                color: 'primary.main',
              },
            }}
          >
            Learn More
          </Button>
        </Box>
      </Box>

      <Box sx={{ pt: 10 }}>
        <StatisticsChanges />
      </Box>
      <Typography variant='h4' sx={{ color: "primary.contrastText", textAlign: 'center', textTransform: "uppercase", pt: { xs: 5, md: 10 } }}>How to contribute</Typography>
      <Box sx={{ display: 'flex', alignItems: 'center', flexDirection: 'column', gap: 5, pt: { xs: 5, md: 10 } }}>
        <Box sx={{ display: 'flex', alignItems: 'right', flexDirection: { xs: 'column', md: 'row' }, gap: 5 }}>
          <Box sx={{ width: '50%', textAlign: 'right'}}>
            <Typography variant="body1">Your contributions help improve the Portal and secure the Soroban ecosystem.</Typography>
            <Typography variant="body1">Claim your role by authorizing with your Discord account in <a href="https://discord.gg/UAnpE7pa" target="_blank" rel="noopener noreferrer">Stellar Developers Discord Server</a></Typography>
          </Box>
          <Box sx={{ display: 'flex', width: '50%', alignItems: 'center', justifyContent: 'center' }}>
            <Button variant='contained' size='large' onClick={() => navigate('/login')}>Log In</Button>
          </Box>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'right', flexDirection: { xs: 'column', md: 'row-reverse' }, gap: 5 }}>
          <Box sx={{ width: '50%', textAlign: 'left'}}>
            <Typography variant="body1">Roles are automatically granted according to the Stellar community guidelines</Typography>
            <Typography variant="body1">Defined in the <a target="_blank" rel="noopener noreferrer" href="https://stellarcommunityfund.gitbook.io/scf-handbook/governance/verified-members/how-to-become-verified">Stellar Community Fund Handbook</a></Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Box component="img" src="/static/images/handbook-logo.avif" sx={{ width: { sm: '10%', md: '80%' } }} />
          </Box>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', flexDirection: 'column', pt: { xs: 5, md: 10 } }}>
            <Typography variant='h4' sx={{ color: "primary.contrastText", textTransform: "uppercase" }}>Roles breakdown</Typography>
            <Box sx={{ overflowX: 'auto', mt: 4 }}>
                <Box component="table" sx={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center' }}>
                <Box component="thead">
                  <Box component="tr">
                  <Box component="th" sx={{ padding: '10px' }}>Role</Box>
                  <Box component="th" sx={{ padding: '10px' }}>Read</Box>
                  <Box component="th" sx={{ padding: '10px' }}>Download</Box>
                  <Box component="th" sx={{ padding: '10px' }}>Create / Edit</Box>
                  <Box component="th" sx={{ padding: '10px' }}>Approve</Box>
                  <Box component="th" sx={{ padding: '10px' }}>Description</Box>
                  </Box>
                </Box>
                <Box component="tbody">
                  {
                    [
                      {
                        name: "Guest",
                        permissions: [ "read" ],
                        description: "Readonly access is available for everyone"
                      },
                      {
                        name: "User (logged in)",
                        permissions: [ "read", "download" ],
                        description: "Authorized users can download reports in the PDF format"
                      },
                      {
                        name: "Contributor",
                        permissions: [ "read", "download", "create" ],
                        description: "Contributor are Pilots (see the handbook) or those who expressed interest in contibuting"
                      },
                      {
                        name: "Moderator",
                        permissions: [ "read", "download", "create", "approve" ],
                        description: "Granted manually to active community members who are looking after the content integrity and quality"
                      }
                    ].map(r => (
                      <Box component="tr" key={r.name}>
                        <Box component="td" sx={{ p: 2 }}>{r.name}</Box>
                        <Box component="td" sx={{ p: 2 }}>{r.permissions.includes("read") ? "✅" : "❌"}</Box>
                        <Box component="td" sx={{ p: 2 }}>{r.permissions.includes("download") ? "✅" : "❌"}</Box>
                        <Box component="td" sx={{ p: 2 }}>{r.permissions.includes("create") ? "✅" : "❌"}</Box>
                        <Box component="td" sx={{ p: 2 }}>{r.permissions.includes("approve") ? "✅" : "❌"}</Box>
                        <Box component="td" sx={{ p: 2, textAlign: 'left', width: '40%' }}>{r.description}</Box>
                      </Box>
                    ))
                  }
                </Box>
                </Box>
            </Box>
        </Box>
      </Box>
      {/* Vulnerability Statistics Pie Chart */}
     {!isOnSmallScreen && (<Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          pt: { xs: 10, md: 20 },
          pb: 20
        }}
      >
        <div style={{ display: 'flex', gap: '20px', justifyContent: 'center', alignItems: 'center', flexDirection: 'column' }}>
          <div>
            <VulnerabilityPieChart
              height={350}
              width={350}
            />
          </div>
          {showTable && (
            <div style={{ paddingTop: '100px', paddingBottom: '100px' }}>
              <VulnerabilityTable />
            </div>
          )}
        </div>
      </Box>)}
    </Box>
  );
};
