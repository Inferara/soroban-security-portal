import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { renderHook } from '@testing-library/react';
import { ThemeProvider, useTheme, SeverityColors, SeverityColorsLight, SeverityTextColorsLight, SeverityTextColorsDark } from '../ThemeContext';

describe('ThemeContext', () => {
  // Mock localStorage
  const mockLocalStorage = {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
    length: 0,
    key: vi.fn(),
  };

  // Mock document.documentElement.style.setProperty
  const mockSetProperty = vi.fn();

  beforeEach(() => {
    Object.defineProperty(window, 'localStorage', {
      value: mockLocalStorage,
      writable: true,
    });
    mockLocalStorage.getItem.mockClear();
    mockLocalStorage.setItem.mockClear();
    mockSetProperty.mockClear();
    document.documentElement.style.setProperty = mockSetProperty;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('ThemeProvider', () => {
    it('provides theme context to children', () => {
      mockLocalStorage.getItem.mockReturnValue('dark');

      const TestComponent = () => {
        const { themeMode } = useTheme();
        return <div data-testid="theme">{themeMode}</div>;
      };

      render(
        <ThemeProvider>
          <TestComponent />
        </ThemeProvider>
      );

      expect(screen.getByTestId('theme')).toHaveTextContent('dark');
    });

    it('defaults to dark theme when no saved preference', () => {
      mockLocalStorage.getItem.mockReturnValue(null);

      const TestComponent = () => {
        const { themeMode } = useTheme();
        return <div data-testid="theme">{themeMode}</div>;
      };

      render(
        <ThemeProvider>
          <TestComponent />
        </ThemeProvider>
      );

      expect(screen.getByTestId('theme')).toHaveTextContent('dark');
    });

    it('restores saved light theme preference', () => {
      mockLocalStorage.getItem.mockReturnValue('light');

      const TestComponent = () => {
        const { themeMode } = useTheme();
        return <div data-testid="theme">{themeMode}</div>;
      };

      render(
        <ThemeProvider>
          <TestComponent />
        </ThemeProvider>
      );

      expect(screen.getByTestId('theme')).toHaveTextContent('light');
    });

    it('toggles theme from dark to light', () => {
      mockLocalStorage.getItem.mockReturnValue('dark');

      const TestComponent = () => {
        const { themeMode, toggleTheme } = useTheme();
        return (
          <div>
            <span data-testid="theme">{themeMode}</span>
            <button onClick={toggleTheme}>Toggle</button>
          </div>
        );
      };

      render(
        <ThemeProvider>
          <TestComponent />
        </ThemeProvider>
      );

      expect(screen.getByTestId('theme')).toHaveTextContent('dark');

      act(() => {
        fireEvent.click(screen.getByRole('button'));
      });

      expect(screen.getByTestId('theme')).toHaveTextContent('light');
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith('themeMode', 'light');
    });

    it('toggles theme from light to dark', () => {
      mockLocalStorage.getItem.mockReturnValue('light');

      const TestComponent = () => {
        const { themeMode, toggleTheme } = useTheme();
        return (
          <div>
            <span data-testid="theme">{themeMode}</span>
            <button onClick={toggleTheme}>Toggle</button>
          </div>
        );
      };

      render(
        <ThemeProvider>
          <TestComponent />
        </ThemeProvider>
      );

      expect(screen.getByTestId('theme')).toHaveTextContent('light');

      act(() => {
        fireEvent.click(screen.getByRole('button'));
      });

      expect(screen.getByTestId('theme')).toHaveTextContent('dark');
    });

    it('sets CSS custom properties for dark theme', () => {
      mockLocalStorage.getItem.mockReturnValue('dark');

      const TestComponent = () => {
        const { themeMode } = useTheme();
        return <div>{themeMode}</div>;
      };

      render(
        <ThemeProvider>
          <TestComponent />
        </ThemeProvider>
      );

      expect(mockSetProperty).toHaveBeenCalledWith('--highlight-bg', '#1a1a1a');
      expect(mockSetProperty).toHaveBeenCalledWith('--highlight-border', '#90caf9');
    });

    it('sets CSS custom properties for light theme', () => {
      mockLocalStorage.getItem.mockReturnValue('light');

      const TestComponent = () => {
        const { themeMode } = useTheme();
        return <div>{themeMode}</div>;
      };

      render(
        <ThemeProvider>
          <TestComponent />
        </ThemeProvider>
      );

      expect(mockSetProperty).toHaveBeenCalledWith('--highlight-bg', '#f0f8ff');
      expect(mockSetProperty).toHaveBeenCalledWith('--highlight-border', '#1976d2');
    });

    it('provides MUI theme object', () => {
      mockLocalStorage.getItem.mockReturnValue('dark');

      const TestComponent = () => {
        const { theme } = useTheme();
        return <div data-testid="palette-mode">{theme.palette.mode}</div>;
      };

      render(
        <ThemeProvider>
          <TestComponent />
        </ThemeProvider>
      );

      expect(screen.getByTestId('palette-mode')).toHaveTextContent('dark');
    });
  });

  describe('useTheme hook', () => {
    it('throws error when used outside ThemeProvider', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => {
        renderHook(() => useTheme());
      }).toThrow('useTheme must be used within a ThemeProvider');

      consoleSpy.mockRestore();
    });

    it('returns themeMode, toggleTheme, and theme', () => {
      mockLocalStorage.getItem.mockReturnValue('dark');

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <ThemeProvider>{children}</ThemeProvider>
      );

      const { result } = renderHook(() => useTheme(), { wrapper });

      expect(result.current.themeMode).toBe('dark');
      expect(typeof result.current.toggleTheme).toBe('function');
      expect(result.current.theme).toBeDefined();
      expect(result.current.theme.palette).toBeDefined();
    });
  });

  describe('SeverityColors', () => {
    it('has all five severity levels', () => {
      expect(SeverityColors).toHaveProperty('critical');
      expect(SeverityColors).toHaveProperty('high');
      expect(SeverityColors).toHaveProperty('medium');
      expect(SeverityColors).toHaveProperty('low');
      expect(SeverityColors).toHaveProperty('note');
    });

    it('has valid color values with alpha channel', () => {
      // All colors should be valid hex with alpha
      const hexWithAlphaRegex = /^#[0-9A-Fa-f]{6,8}$/;
      expect(SeverityColors.critical).toMatch(hexWithAlphaRegex);
      expect(SeverityColors.high).toMatch(hexWithAlphaRegex);
      expect(SeverityColors.medium).toMatch(hexWithAlphaRegex);
      expect(SeverityColors.low).toMatch(hexWithAlphaRegex);
      expect(SeverityColors.note).toMatch(hexWithAlphaRegex);
    });
  });

  describe('SeverityColorsLight', () => {
    it('has all five severity levels', () => {
      expect(SeverityColorsLight).toHaveProperty('critical');
      expect(SeverityColorsLight).toHaveProperty('high');
      expect(SeverityColorsLight).toHaveProperty('medium');
      expect(SeverityColorsLight).toHaveProperty('low');
      expect(SeverityColorsLight).toHaveProperty('note');
    });

    it('has 20% alpha transparency suffix', () => {
      // All light colors should end with 20 (20% opacity)
      expect(SeverityColorsLight.critical).toMatch(/20$/);
      expect(SeverityColorsLight.high).toMatch(/20$/);
      expect(SeverityColorsLight.medium).toMatch(/20$/);
      expect(SeverityColorsLight.low).toMatch(/20$/);
      expect(SeverityColorsLight.note).toMatch(/20$/);
    });
  });

  describe('SeverityTextColorsLight', () => {
    it('has all five severity levels', () => {
      expect(SeverityTextColorsLight).toHaveProperty('critical');
      expect(SeverityTextColorsLight).toHaveProperty('high');
      expect(SeverityTextColorsLight).toHaveProperty('medium');
      expect(SeverityTextColorsLight).toHaveProperty('low');
      expect(SeverityTextColorsLight).toHaveProperty('note');
    });

    it('has valid 6-digit hex colors', () => {
      const hexRegex = /^#[0-9A-Fa-f]{6}$/;
      expect(SeverityTextColorsLight.critical).toMatch(hexRegex);
      expect(SeverityTextColorsLight.high).toMatch(hexRegex);
      expect(SeverityTextColorsLight.medium).toMatch(hexRegex);
      expect(SeverityTextColorsLight.low).toMatch(hexRegex);
      expect(SeverityTextColorsLight.note).toMatch(hexRegex);
    });
  });

  describe('SeverityTextColorsDark', () => {
    it('has all five severity levels', () => {
      expect(SeverityTextColorsDark).toHaveProperty('critical');
      expect(SeverityTextColorsDark).toHaveProperty('high');
      expect(SeverityTextColorsDark).toHaveProperty('medium');
      expect(SeverityTextColorsDark).toHaveProperty('low');
      expect(SeverityTextColorsDark).toHaveProperty('note');
    });

    it('has valid 6-digit hex colors', () => {
      const hexRegex = /^#[0-9A-Fa-f]{6}$/;
      expect(SeverityTextColorsDark.critical).toMatch(hexRegex);
      expect(SeverityTextColorsDark.high).toMatch(hexRegex);
      expect(SeverityTextColorsDark.medium).toMatch(hexRegex);
      expect(SeverityTextColorsDark.low).toMatch(hexRegex);
      expect(SeverityTextColorsDark.note).toMatch(hexRegex);
    });

    it('has lighter colors than SeverityTextColorsLight for contrast on dark backgrounds', () => {
      // Dark mode colors should have higher RGB values (lighter) for visibility
      // This is a simplified check - dark mode colors end with lighter hex values
      const getDarknessScore = (hex: string) => {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return r + g + b;
      };

      // Dark mode colors should be lighter (higher score)
      expect(getDarknessScore(SeverityTextColorsDark.critical))
        .toBeGreaterThan(getDarknessScore(SeverityTextColorsLight.critical));
      expect(getDarknessScore(SeverityTextColorsDark.high))
        .toBeGreaterThan(getDarknessScore(SeverityTextColorsLight.high));
    });
  });
});
