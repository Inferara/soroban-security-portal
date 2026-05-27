import { FC } from 'react';
import Box from '@mui/material/Box';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { useTheme } from '../../contexts/ThemeContext';

/**
 * Slowly-drifting aurora / gradient-mesh layer used behind the hero for depth and
 * gentle motion. Three blurred colored blobs (gold, blue, violet) animate on long,
 * offset loops. Frozen when the user prefers reduced motion. Pointer-events: none.
 */
export const AuroraBackground: FC = () => {
  const reduced = useReducedMotion();
  const { themeMode } = useTheme();

  const blob = (color: string, size: number, top: string, left: string, anim: string, delay: string) => ({
    position: 'absolute' as const,
    width: size,
    height: size,
    top,
    left,
    borderRadius: '50%',
    background: color,
    filter: 'blur(70px)',
    opacity: themeMode === 'dark' ? 0.75 : 0.5,
    animation: reduced ? 'none' : `${anim} 16s ease-in-out infinite`,
    animationDelay: delay,
    willChange: 'transform',
  });

  return (
    <Box
      aria-hidden
      sx={{
        position: 'absolute',
        inset: 0,
        overflow: 'hidden',
        pointerEvents: 'none',
        zIndex: 0,
        '@keyframes auroraA': {
          '0%,100%': { transform: 'translate(0,0) scale(1)' },
          '50%': { transform: 'translate(60px,40px) scale(1.15)' },
        },
        '@keyframes auroraB': {
          '0%,100%': { transform: 'translate(0,0) scale(1.1)' },
          '50%': { transform: 'translate(-70px,30px) scale(0.95)' },
        },
        '@keyframes auroraC': {
          '0%,100%': { transform: 'translate(0,0) scale(1)' },
          '50%': { transform: 'translate(40px,-50px) scale(1.2)' },
        },
      }}
    >
      <Box sx={blob('radial-gradient(circle, rgba(212,162,60,0.9), transparent 70%)', 520, '-10%', '60%', 'auroraA', '0s')} />
      <Box sx={blob('radial-gradient(circle, rgba(45,78,255,0.9), transparent 70%)', 620, '30%', '-10%', 'auroraB', '-6s')} />
      <Box sx={blob('radial-gradient(circle, rgba(124,77,255,0.8), transparent 70%)', 460, '55%', '55%', 'auroraC', '-12s')} />
    </Box>
  );
};
