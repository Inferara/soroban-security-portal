import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useResponsive } from '../useResponsive';

// Mock useMediaQuery
vi.mock('@mui/material/useMediaQuery', () => ({
  default: vi.fn(),
}));

const mockedUseMediaQuery = vi.mocked(useMediaQuery);

describe('useResponsive', () => {
  const theme = createTheme();
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <ThemeProvider theme={theme}>{children}</ThemeProvider>
  );

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('mobile breakpoint (xs)', () => {
    beforeEach(() => {
      // Configure mocks for xs breakpoint
      mockedUseMediaQuery.mockImplementation((query: string) => {
        if (query.includes('max-width') && query.includes('899')) return true; // down('md') - isMobile
        if (query.includes('min-width:900') && query.includes('max-width:1199')) return false; // between('md', 'lg') - isTablet
        if (query.includes('min-width') && query.includes('1200')) return false; // up('lg') - isDesktop
        if (query.includes('max-width') && query.includes('599')) return true; // down('sm') - isSmallScreen
        return false;
      });
    });

    it('returns isMobile true', () => {
      const { result } = renderHook(() => useResponsive(), { wrapper });
      expect(result.current.isMobile).toBe(true);
    });

    it('returns isTablet false', () => {
      const { result } = renderHook(() => useResponsive(), { wrapper });
      expect(result.current.isTablet).toBe(false);
    });

    it('returns isDesktop false', () => {
      const { result } = renderHook(() => useResponsive(), { wrapper });
      expect(result.current.isDesktop).toBe(false);
    });

    it('returns isSmallScreen true', () => {
      const { result } = renderHook(() => useResponsive(), { wrapper });
      expect(result.current.isSmallScreen).toBe(true);
    });

    it('returns breakpoint xs', () => {
      const { result } = renderHook(() => useResponsive(), { wrapper });
      expect(result.current.breakpoint).toBe('xs');
    });
  });

  describe('mobile breakpoint (sm)', () => {
    beforeEach(() => {
      mockedUseMediaQuery.mockImplementation((query: string) => {
        if (query.includes('max-width') && query.includes('899')) return true; // isMobile
        if (query.includes('min-width:900') && query.includes('max-width:1199')) return false; // isTablet
        if (query.includes('min-width') && query.includes('1200')) return false; // isDesktop
        if (query.includes('max-width') && query.includes('599')) return false; // isSmallScreen
        return false;
      });
    });

    it('returns isMobile true', () => {
      const { result } = renderHook(() => useResponsive(), { wrapper });
      expect(result.current.isMobile).toBe(true);
    });

    it('returns isSmallScreen false', () => {
      const { result } = renderHook(() => useResponsive(), { wrapper });
      expect(result.current.isSmallScreen).toBe(false);
    });

    it('returns breakpoint sm', () => {
      const { result } = renderHook(() => useResponsive(), { wrapper });
      expect(result.current.breakpoint).toBe('sm');
    });
  });

  describe('tablet breakpoint (md)', () => {
    beforeEach(() => {
      mockedUseMediaQuery.mockImplementation((query: string) => {
        if (query.includes('max-width') && query.includes('899')) return false; // isMobile
        if (query.includes('min-width:900') && query.includes('max-width:1199')) return true; // isTablet
        if (query.includes('min-width') && query.includes('1200')) return false; // isDesktop
        if (query.includes('max-width') && query.includes('599')) return false; // isSmallScreen
        return false;
      });
    });

    it('returns isMobile false', () => {
      const { result } = renderHook(() => useResponsive(), { wrapper });
      expect(result.current.isMobile).toBe(false);
    });

    it('returns isTablet true', () => {
      const { result } = renderHook(() => useResponsive(), { wrapper });
      expect(result.current.isTablet).toBe(true);
    });

    it('returns isDesktop false', () => {
      const { result } = renderHook(() => useResponsive(), { wrapper });
      expect(result.current.isDesktop).toBe(false);
    });

    it('returns breakpoint md', () => {
      const { result } = renderHook(() => useResponsive(), { wrapper });
      expect(result.current.breakpoint).toBe('md');
    });
  });

  describe('desktop breakpoint (lg)', () => {
    beforeEach(() => {
      mockedUseMediaQuery.mockImplementation((query: string) => {
        if (query.includes('max-width') && query.includes('899')) return false; // isMobile
        if (query.includes('min-width:900') && query.includes('max-width:1199')) return false; // isTablet
        if (query.includes('min-width') && query.includes('1200')) return true; // isDesktop
        if (query.includes('max-width') && query.includes('599')) return false; // isSmallScreen
        return false;
      });
    });

    it('returns isMobile false', () => {
      const { result } = renderHook(() => useResponsive(), { wrapper });
      expect(result.current.isMobile).toBe(false);
    });

    it('returns isTablet false', () => {
      const { result } = renderHook(() => useResponsive(), { wrapper });
      expect(result.current.isTablet).toBe(false);
    });

    it('returns isDesktop true', () => {
      const { result } = renderHook(() => useResponsive(), { wrapper });
      expect(result.current.isDesktop).toBe(true);
    });

    it('returns breakpoint lg', () => {
      const { result } = renderHook(() => useResponsive(), { wrapper });
      expect(result.current.breakpoint).toBe('lg');
    });
  });

  describe('return type', () => {
    beforeEach(() => {
      mockedUseMediaQuery.mockReturnValue(false);
    });

    it('returns all required properties', () => {
      const { result } = renderHook(() => useResponsive(), { wrapper });

      expect(result.current).toHaveProperty('isMobile');
      expect(result.current).toHaveProperty('isTablet');
      expect(result.current).toHaveProperty('isDesktop');
      expect(result.current).toHaveProperty('isSmallScreen');
      expect(result.current).toHaveProperty('breakpoint');
    });

    it('returns boolean values for flags', () => {
      const { result } = renderHook(() => useResponsive(), { wrapper });

      expect(typeof result.current.isMobile).toBe('boolean');
      expect(typeof result.current.isTablet).toBe('boolean');
      expect(typeof result.current.isDesktop).toBe('boolean');
      expect(typeof result.current.isSmallScreen).toBe('boolean');
    });

    it('returns string value for breakpoint', () => {
      const { result } = renderHook(() => useResponsive(), { wrapper });

      expect(typeof result.current.breakpoint).toBe('string');
      expect(['xs', 'sm', 'md', 'lg', 'xl']).toContain(result.current.breakpoint);
    });
  });
});
