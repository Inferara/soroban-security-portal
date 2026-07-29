import { FC } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../../../../contexts/ThemeContext';
import HomeIcon from '@mui/icons-material/Home';
import { environment } from '../../../../environments/environment';

export const NotFound: FC = () => {
  const navigate = useNavigate();
  const { tokens } = useTheme();

  const handleBackHome = () => {
    navigate(`${environment.basePath}/`);
  };

  return (
    <Box
      id="not-found-page"
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '70vh',
        textAlign: 'center',
        px: 3,
      }}
    >
      {/* Large 404 number with gold gradient */}
      <Typography
        variant="h1"
        component="h1"
        sx={{
          fontSize: { xs: '6rem', sm: '8rem', md: '10rem' },
          fontWeight: 900,
          lineHeight: 1,
          backgroundImage: tokens.goldGradient,
          WebkitBackgroundClip: 'text',
          backgroundClip: 'text',
          color: 'transparent',
          mb: 1,
          userSelect: 'none',
          filter: 'drop-shadow(0 4px 24px rgba(212, 162, 60, 0.25))',
        }}
      >
        404
      </Typography>

      {/* Subtitle */}
      <Typography
        variant="h5"
        component="h2"
        sx={{
          fontWeight: 700,
          color: 'text.primary',
          mb: 1.5,
        }}
      >
        Page not found
      </Typography>

      {/* Friendly description */}
      <Typography
        variant="body1"
        sx={{
          color: 'text.secondary',
          maxWidth: 480,
          mb: 4,
          lineHeight: 1.7,
        }}
      >
        The page you're looking for doesn't exist or may have been moved.
        Double-check the URL or head back home.
      </Typography>

      {/* Back to Home button */}
      <Button
        id="not-found-back-home"
        variant="contained"
        size="large"
        startIcon={<HomeIcon />}
        onClick={handleBackHome}
        sx={{
          px: 4,
          py: 1.5,
          fontSize: '1rem',
          fontWeight: 700,
          textTransform: 'none',
          borderRadius: 2,
        }}
      >
        Back to Home
      </Button>
    </Box>
  );
};
