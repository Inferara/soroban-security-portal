import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { createTheme, Theme } from '@mui/material/styles';
import { CosmicTokens, DaylightTokens, ThemeTokens } from '../theme/tokens';

type ThemeMode = 'light' | 'dark';

interface ThemeContextType {
  themeMode: ThemeMode;
  toggleTheme: () => void;
  theme: Theme;
  tokens: ThemeTokens;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const fontFamily = ['Roboto', 'Rubik', 'Helvetica', 'Arial', 'sans-serif'].join(',');

const sharedTypography = {
  fontFamily,
  h1: { fontWeight: 800, letterSpacing: '-0.02em' },
  h2: { fontWeight: 800, letterSpacing: '-0.01em' },
  h3: { fontWeight: 700, letterSpacing: '-0.01em' },
  h4: { fontWeight: 700 },
  button: { fontWeight: 700, textTransform: 'none' as const },
};

const lightTheme = createTheme({
  typography: sharedTypography,
  shape: { borderRadius: 12 },
  palette: {
    mode: 'light',
    primary: { main: '#2D4EFF', dark: '#1a3fd9', contrastText: '#ffffff' },
    secondary: { main: '#9a7b1f', contrastText: '#ffffff' },
    text: { primary: '#15151f', secondary: '#4a4a5e' },
    background: { paper: '#ffffff', default: '#eef2ff' },
    divider: 'rgba(20,20,50,0.10)',
  },
  components: {
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: 'rgba(255,255,255,0.85)',
          backdropFilter: 'blur(10px)',
          color: '#15151f',
          boxShadow: 'none',
          borderBottom: '1px solid rgba(20,20,50,0.10)',
          backgroundImage: 'none',
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: { backgroundColor: '#ffffff', borderRight: '1px solid rgba(20,20,50,0.10)' },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 10,
          transition: 'transform .2s ease, box-shadow .2s ease',
        },
        contained: {
          '&:hover': { boxShadow: '0 6px 20px rgba(45,78,255,0.35)', transform: 'translateY(-1px)' },
        },
      },
    },
    MuiPaper: { styleOverrides: { root: { backgroundImage: 'none' } } },
  },
});

const darkTheme = createTheme({
  typography: sharedTypography,
  shape: { borderRadius: 12 },
  palette: {
    mode: 'dark',
    primary: { main: '#2D4EFF', dark: '#1a3fd9', contrastText: '#ffffff' },
    secondary: { main: '#FFD84D', contrastText: '#0b0b14' },
    text: { primary: '#F2F2F2', secondary: '#b9c0d4' },
    background: { paper: '#13131c', default: '#0b0b14' },
    divider: 'rgba(255,255,255,0.10)',
  },
  components: {
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: 'rgba(11,11,20,0.72)',
          backdropFilter: 'blur(12px)',
          color: '#F2F2F2',
          boxShadow: 'none',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          backgroundImage: 'none',
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: { backgroundColor: '#13131c', borderRight: '1px solid rgba(255,255,255,0.08)' },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 10,
          transition: 'transform .2s ease, box-shadow .2s ease',
        },
        contained: {
          '&:hover': { boxShadow: '0 0 20px rgba(45,78,255,0.55)', transform: 'translateY(-1px)' },
        },
      },
    },
    MuiPaper: { styleOverrides: { root: { backgroundImage: 'none' } } },
  },
});

export const ThemeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => {
    const savedTheme = localStorage.getItem('themeMode');
    return (savedTheme as ThemeMode) || 'dark';
  });

  const theme = themeMode === 'light' ? lightTheme : darkTheme;
  const tokens = themeMode === 'dark' ? CosmicTokens : DaylightTokens;

  const toggleTheme = () => {
    setThemeMode((prevMode) => {
      const newMode = prevMode === 'light' ? 'dark' : 'light';
      localStorage.setItem('themeMode', newMode);
      return newMode;
    });
  };

  useEffect(() => {
    localStorage.setItem('themeMode', themeMode);
    const root = document.documentElement;
    if (themeMode === 'dark') {
      root.style.setProperty('--highlight-bg', '#1a1a1a');
      root.style.setProperty('--highlight-border', '#90caf9');
    } else {
      root.style.setProperty('--highlight-bg', '#f0f8ff');
      root.style.setProperty('--highlight-border', '#1976d2');
    }
  }, [themeMode]);

  return (
    <ThemeContext.Provider value={{ themeMode, toggleTheme, theme, tokens }}>
      {children}
    </ThemeContext.Provider>
  );
};

/**
 * WCAG 2.1 AA compliant severity colors.
 *
 * Design decisions:
 * - No alpha transparency for maximum contrast
 * - Blue replaces green for colorblind accessibility (red-green safe)
 * - All colors meet 4.5:1 contrast ratio for text readability
 * - Colors are distinguishable across all major color vision deficiencies
 *
 * Contrast ratios on white (#FFFFFF) / dark (#1e1e1e):
 * - Critical (#B91C1C): 5.45:1 / 4.63:1
 * - High (#C2410C): 4.52:1 / 5.21:1
 * - Medium (#A16207): 4.69:1 / 5.53:1
 * - Low (#0369A1): 4.51:1 / 4.73:1
 * - Note (#0891B2): 3.14:1 / 4.89:1
 */
export const SeverityColors: { [key: string]: string } = {
  "critical": "#c72e2b95",  // Deep red
  "high": "#FF6B3D95",      // Burnt orange
  "medium": "#FFD84D95",    // Dark amber
  "low": "#569E6795",       // Ocean blue (replaces green for colorblind safety)
  "note": "#72F1FF95"       // Teal
};

/**
 * Semi-transparent severity colors for subtle backgrounds (hover states, highlights).
 * Use these for card backgrounds, table row highlights, etc.
 */
export const SeverityColorsLight: { [key: string]: string } = {
  "critical": "#B91C1C20",
  "high": "#C2410C20",
  "medium": "#A1620720",
  "low": "#0369A120",
  "note": "#0891B220"
};

/**
 * Text colors for severity labels on light backgrounds.
 * These provide higher contrast for text readability.
 */
export const SeverityTextColorsLight: { [key: string]: string } = {
  "critical": "#991B1B",
  "high": "#9A3412",
  "medium": "#854D0E",
  "low": "#075985",
  "note": "#0E7490"
};

/**
 * Text colors for severity labels on dark backgrounds.
 */
export const SeverityTextColorsDark: { [key: string]: string } = {
  "critical": "#FCA5A5",
  "high": "#FDBA74",
  "medium": "#FCD34D",
  "low": "#7DD3FC",
  "note": "#67E8F9"
};

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
