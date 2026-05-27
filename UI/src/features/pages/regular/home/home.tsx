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
import { RolesInfo } from './roles-info';
import { RevealOnScroll } from '../../../../components/common/RevealOnScroll';
import { AuroraBackground } from '../../../../components/common/AuroraBackground';
import { useTheme } from '../../../../contexts/ThemeContext';
import { useReducedMotion } from '../../../../hooks/useReducedMotion';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import KeyboardArrowDownRoundedIcon from '@mui/icons-material/KeyboardArrowDownRounded';

export const Home: FC = () => {
  const navigate = useNavigate();
  const { tokens, themeMode } = useTheme();
  const reduced = useReducedMotion();
  const [parallax, setParallax] = useState({ x: 0, y: 0 });
  const showTable = false;

  const handleHeroMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (reduced) return;
    const r = e.currentTarget.getBoundingClientRect();
    setParallax({
      x: (e.clientX - r.left) / r.width - 0.5,
      y: (e.clientY - r.top) / r.height - 0.5,
    });
  };

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
    <Box sx={{ position: 'relative', minHeight: '100vh', overflow: 'hidden', elevation: 0, background: tokens.heroBackground }}>
      {/* Animated aurora / gradient-mesh depth layer */}
      <AuroraBackground />

      {/* Content Overlay */}
      <Box
        id="hero"
        onMouseMove={handleHeroMouseMove}
        onMouseLeave={() => setParallax({ x: 0, y: 0 })}
        sx={{
          position: 'relative',
          zIndex: 1,
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          pt: { xs: '40px', sm: 0 },
          overflow: 'hidden',
        }}
      >
        {/* GalaxyCanvas with subtle mouse parallax */}
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            zIndex: 0,
            pointerEvents: 'none',
            transform: `translate3d(${parallax.x * 24}px, ${parallax.y * 24}px, 0)`,
            transition: reduced ? 'none' : 'transform .35s cubic-bezier(.22,.61,.36,1)',
          }}
        >
          <GalaxyCanvas />
        </Box>

        {/* Foreground content with 3D parallax tilt for depth */}
        <Box
          sx={{
            position: 'relative',
            zIndex: 3,
            textAlign: 'center',
            px: 2,
            transformStyle: 'preserve-3d',
            transform: reduced
              ? 'none'
              : `perspective(1100px) rotateY(${parallax.x * 7}deg) rotateX(${parallax.y * -7}deg) translateZ(0)`,
            transition: reduced ? 'none' : 'transform .3s cubic-bezier(.22,.61,.36,1)',
          }}
        >
          {/* Glow bloom behind the headline */}
          <Box
            aria-hidden
            sx={{
              position: 'absolute',
              top: '40%',
              left: '50%',
              width: { xs: 360, md: 720 },
              height: { xs: 200, md: 320 },
              transform: 'translate(-50%, -50%)',
              background:
                themeMode === 'dark'
                  ? 'radial-gradient(closest-side, rgba(45,78,255,0.45), rgba(212,162,60,0.18), transparent 75%)'
                  : 'radial-gradient(closest-side, rgba(45,78,255,0.16), rgba(184,134,11,0.12), transparent 75%)',
              filter: 'blur(40px)',
              pointerEvents: 'none',
              zIndex: -1,
            }}
          />
          {/* Eyebrow */}
          <Box
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 1,
              px: 2,
              py: 0.75,
              mb: { xs: 2, md: 3 },
              borderRadius: 999,
              border: '1px solid',
              borderColor: themeMode === 'dark' ? 'rgba(212,162,60,0.35)' : 'rgba(184,134,11,0.35)',
              backgroundColor: themeMode === 'dark' ? 'rgba(212,162,60,0.08)' : 'rgba(184,134,11,0.06)',
              backdropFilter: 'blur(6px)',
              color: tokens.accentGoldBright,
              fontSize: '0.8rem',
              fontWeight: 700,
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
            }}
          >
            <Box component="span" sx={{ width: 7, height: 7, borderRadius: '50%', background: tokens.accentGoldBright, boxShadow: tokens.glowGold }} />
            Soroban smart-contract security
          </Box>

          {/* Headline with animated shimmer */}
          <Typography
            variant="h1"
            component="h1"
            sx={{
              fontWeight: 900,
              lineHeight: 0.98,
              letterSpacing: '-0.03em',
              fontSize: 'clamp(3.25rem, 8vw, 7.5rem)',
              filter: themeMode === 'dark' ? 'drop-shadow(0 6px 40px rgba(45,78,255,0.35))' : 'none',
              backgroundImage:
                themeMode === 'dark'
                  ? 'linear-gradient(100deg, #ffffff 0%, #E9C46A 22%, #ffffff 46%, #7f9bff 72%, #ffffff 100%)'
                  : 'linear-gradient(100deg, #15151f 0%, #B8860B 24%, #15151f 48%, #2D4EFF 74%, #15151f 100%)',
              backgroundSize: '220% auto',
              WebkitBackgroundClip: 'text',
              backgroundClip: 'text',
              color: 'transparent',
              animation: reduced ? 'none' : 'heroShimmer 7s linear infinite',
              '@keyframes heroShimmer': { to: { backgroundPosition: '220% center' } },
            }}
          >
            Stellar Security Portal
          </Typography>

          <Typography
            component="p"
            sx={{
              mt: { xs: 2, md: 3 },
              mb: { xs: 3, md: 4 },
              mx: 'auto',
              maxWidth: 720,
              color: themeMode === 'dark' ? 'rgba(255,255,255,0.78)' : 'text.secondary',
              fontSize: 'clamp(1.05rem, 1.4vw, 1.35rem)',
              lineHeight: 1.6,
            }}
          >
            Your go-to hub for everything secure in the Soroban ecosystem — audit history,
            tools, and top-tier experts who put Soroban projects through their paces.
          </Typography>

          {/* Action Buttons */}
          <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2, flexWrap: 'wrap' }}>
            <Button
              onClick={handleGetStarted}
              endIcon={<ArrowForwardRoundedIcon />}
              sx={{
                px: 4,
                py: 1.5,
                fontSize: '1.05rem',
                fontWeight: 700,
                textTransform: 'none',
                borderRadius: 999,
                color: '#fff',
                background: 'linear-gradient(135deg, #2D4EFF 0%, #6E5BFF 100%)',
                boxShadow: '0 8px 30px rgba(45,78,255,0.45)',
                position: 'relative',
                overflow: 'hidden',
                transition: 'transform .2s ease, box-shadow .2s ease',
                '&:hover': {
                  background: 'linear-gradient(135deg, #2D4EFF 0%, #6E5BFF 100%)',
                  transform: reduced ? 'none' : 'translateY(-2px)',
                  boxShadow: '0 12px 40px rgba(110,91,255,0.6)',
                },
                '& .MuiButton-endIcon': { transition: 'transform .2s ease' },
                '&:hover .MuiButton-endIcon': { transform: reduced ? 'none' : 'translateX(4px)' },
                '&::before': {
                  content: '""',
                  position: 'absolute',
                  top: 0,
                  left: '-150%',
                  width: '60%',
                  height: '100%',
                  background: 'linear-gradient(120deg, transparent 0%, rgba(255,255,255,0.45) 50%, transparent 100%)',
                  transform: 'skewX(-20deg)',
                  animation: reduced ? 'none' : 'heroSheen 3.5s ease-in-out infinite',
                },
                '@keyframes heroSheen': {
                  '0%': { left: '-150%' },
                  '55%': { left: '160%' },
                  '100%': { left: '160%' },
                },
              }}
            >
              Explore vulnerabilities
            </Button>

            <Button
              onClick={handleLearnMore}
              sx={{
                px: 4,
                py: 1.5,
                fontSize: '1.05rem',
                fontWeight: 700,
                textTransform: 'none',
                borderRadius: 999,
                color: themeMode === 'dark' ? '#fff' : 'text.primary',
                backgroundColor: themeMode === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(20,20,50,0.04)',
                border: '1px solid',
                borderColor: themeMode === 'dark' ? 'rgba(255,255,255,0.18)' : 'rgba(20,20,50,0.18)',
                backdropFilter: 'blur(8px)',
                transition: 'all .2s ease',
                '&:hover': {
                  borderColor: tokens.accentGoldBright,
                  color: tokens.accentGoldBright,
                  backgroundColor: themeMode === 'dark' ? 'rgba(212,162,60,0.08)' : 'rgba(184,134,11,0.06)',
                  transform: reduced ? 'none' : 'translateY(-2px)',
                },
              }}
            >
              Learn more
            </Button>
          </Box>
        </Box>

        {/* Scroll cue */}
        <Box
          sx={{
            position: 'absolute',
            bottom: 28,
            left: '50%',
            zIndex: 3,
            color: themeMode === 'dark' ? 'rgba(255,255,255,0.55)' : 'text.secondary',
            display: { xs: 'none', md: 'flex' },
            animation: reduced ? 'none' : 'scrollBob 2s ease-in-out infinite',
            '@keyframes scrollBob': {
              '0%,100%': { transform: 'translateX(-50%) translateY(0)' },
              '50%': { transform: 'translateX(-50%) translateY(8px)' },
            },
          }}
        >
          <KeyboardArrowDownRoundedIcon fontSize="large" />
        </Box>
      </Box>

      <RevealOnScroll>
        <Box sx={{ pt: 10 }}>
          <StatisticsChanges />
        </Box>
      </RevealOnScroll>
      <RevealOnScroll delay={120}>
        <Box sx={{ pt: 10 }}>
          <RolesInfo isCompact={isOnSmallScreen} />
        </Box>
      </RevealOnScroll>
      {/* Vulnerability Statistics Pie Chart */}
     {!isOnSmallScreen && (
      <RevealOnScroll delay={240}>
        <Box
          sx={{
            width: '100%',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            pt: { xs: 10, md: 20 },
            pb: 20
          }}
        >
          <VulnerabilityPieChart
            height={350}
            width={350}
          />
          {showTable && (
            <Box sx={{ pt: 10, pb: 10 }}>
              <VulnerabilityTable />
            </Box>
          )}
        </Box>
      </RevealOnScroll>)}
    </Box>
  );
};
