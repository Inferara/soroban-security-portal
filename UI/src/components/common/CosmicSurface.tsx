import { FC, ReactNode } from 'react';
import Box from '@mui/material/Box';
import type { SxProps, Theme } from '@mui/material/styles';
import { useTheme } from '../../contexts/ThemeContext';

interface CosmicSurfaceProps {
  children: ReactNode;
  /** Enable hover lift + glow (default true). */
  interactive?: boolean;
  sx?: SxProps<Theme>;
}

/**
 * Themed surface for cards/sections: hairline border, soft shadow,
 * and (optional) hover glow. Reads cosmic/daylight tokens from ThemeContext.
 */
export const CosmicSurface: FC<CosmicSurfaceProps> = ({ children, interactive = true, sx }) => {
  const { tokens } = useTheme();
  return (
    <Box
      sx={{
        backgroundColor: tokens.surface,
        border: `1px solid ${tokens.surfaceBorder}`,
        borderRadius: 3,
        boxShadow: tokens.surfaceShadow,
        backdropFilter: 'blur(6px)',
        transition: 'transform .25s ease, box-shadow .25s ease',
        ...(interactive && {
          '&:hover': {
            transform: 'translateY(-3px)',
            boxShadow: tokens.surfaceShadowHover,
            '@media (prefers-reduced-motion: reduce)': { transform: 'none' },
          },
        }),
        ...sx,
      }}
    >
      {children}
    </Box>
  );
};
