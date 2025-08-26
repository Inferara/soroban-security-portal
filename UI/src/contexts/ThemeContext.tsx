import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { createTheme, PaletteColor, PaletteOptions, Theme } from '@mui/material/styles';

type ThemeMode = 'light' | 'dark';

interface ThemeContextType {
  themeMode: ThemeMode;
  toggleTheme: () => void;
  theme: Theme;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const lightTheme = createTheme({
  typography: {
    fontFamily: [
      "Roboto",
      "Rubik",
      "Helvetica",
      "Arial",
      "sans-serif",
    ].join(','),
  },
  palette: {
    mode: 'light',
    primary: {
      main: '#1976d2',
      contrastText: '#F2F2F2',
    },
    secondary: {
      main: '#2f2f2f',
      contrastText: '#F2F2F2',
    },
    text: {
      primary: '#000000',
      secondary: '#213547',
    },
    background: {
      paper: '#F2F2F2',
      default: '#f7f8fa',
    },
    divider: '#e0e0e0',
  },
  components: {
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: '#F2F2F2',
          color: '#222',
          boxShadow: 'none',
          borderBottom: '1px solid #e0e0e0',
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          backgroundColor: '#F2F2F2',
          borderRight: '1px solid #e0e0e0',
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          backgroundColor: '#2D4EFF',
          color: '#F2F2F2',
          '&:hover': {
            backgroundColor: '#1a3fd9',
          },
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            backgroundColor: '#fafafa',
          },
        },
      },
    },
    MuiFormControl: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            backgroundColor: '#fafafa',
          },
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          backgroundColor: '#fafafa',
        },
      },
    },
    MuiSelect: {
      styleOverrides: {
        root: {
          backgroundColor: '#fafafa',
        },
      },
    },
  },
});

const darkThemePalette: PaletteOptions = {
  mode: 'dark',
  primary: {
    main: '#F2F2F2',
    contrastText: '#DDCDB1',
  },
  secondary: {
    main: '#DDCDB1',
  },
  text: {
    primary: '#F2F2F2',
    secondary: '#b3b3b3',
  },
  background: {
    paper: '#1e1e1e',
    default: '#1e1e1e',
  },
  divider: '#333333',
};

const darkTheme = createTheme({
  typography: {
    fontFamily: [
      "Roboto",
      "Rubik",
      "Helvetica",
      "Arial",
      "sans-serif",
    ].join(','),
  },
  palette: darkThemePalette,
  components: {
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: '#1e1e1e',
          color: '#F2F2F2',
          boxShadow: 'none',
          borderBottom: '1px solid #333333',
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          backgroundColor: '#1e1e1e',
          borderRight: '1px solid #333333',
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          fontSize: '1rem',
          fontWeight: 900,
          borderRadius: '8px',
          backgroundColor: '#2D4EFF',
          color: (darkThemePalette.primary as PaletteColor).main,
          '&:hover': {
            backgroundColor: '#1a3fd9',
          },
        },
      },
    },
  },
});

export const ThemeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => {
    const savedTheme = localStorage.getItem('themeMode');
    return (savedTheme as ThemeMode) || 'dark';
  });

  const theme = themeMode === 'light' ? lightTheme : darkTheme;

  const toggleTheme = () => {
    setThemeMode(prevMode => {
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
    <ThemeContext.Provider value={{ themeMode, toggleTheme, theme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}; 