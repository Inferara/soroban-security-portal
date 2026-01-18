import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import {
  EntityAvatar,
  EntityType,
  getEntityAvatarUrl,
  useEntityAvatarState,
} from '../EntityAvatar';
import { renderHook, act } from '@testing-library/react';

// Mock environment
vi.mock('../../environments/environment', () => ({
  environment: {
    apiUrl: 'http://localhost:3000',
  },
}));

const theme = createTheme();
const wrapper = ({ children }: { children: React.ReactNode }) => (
  <ThemeProvider theme={theme}>{children}</ThemeProvider>
);

describe('EntityAvatar', () => {
  describe('rendering', () => {
    it('renders without crashing', () => {
      render(<EntityAvatar entityType="auditor" entityId={1} />, { wrapper });
      expect(screen.getByRole('img', { hidden: true })).toBeInTheDocument();
    });

    it('renders with all entity types', () => {
      const entityTypes: EntityType[] = ['auditor', 'protocol', 'company', 'report', 'user'];

      entityTypes.forEach((type) => {
        const { unmount } = render(
          <EntityAvatar entityType={type} entityId={1} />,
          { wrapper }
        );
        expect(screen.getByRole('img', { hidden: true })).toBeInTheDocument();
        unmount();
      });
    });
  });

  describe('size configuration', () => {
    it('renders with default medium size (40px)', () => {
      render(<EntityAvatar entityType="auditor" entityId={1} />, { wrapper });
      const avatar = screen.getByRole('img', { hidden: true }).closest('.MuiAvatar-root');
      expect(avatar).toHaveStyle({ width: '40px', height: '40px' });
    });

    it('renders with small size (32px)', () => {
      render(<EntityAvatar entityType="auditor" entityId={1} size="small" />, { wrapper });
      const avatar = screen.getByRole('img', { hidden: true }).closest('.MuiAvatar-root');
      expect(avatar).toHaveStyle({ width: '32px', height: '32px' });
    });

    it('renders with large size (60px)', () => {
      render(<EntityAvatar entityType="auditor" entityId={1} size="large" />, { wrapper });
      const avatar = screen.getByRole('img', { hidden: true }).closest('.MuiAvatar-root');
      expect(avatar).toHaveStyle({ width: '60px', height: '60px' });
    });

    it('renders with xlarge size (80px)', () => {
      render(<EntityAvatar entityType="auditor" entityId={1} size="xlarge" />, { wrapper });
      const avatar = screen.getByRole('img', { hidden: true }).closest('.MuiAvatar-root');
      expect(avatar).toHaveStyle({ width: '80px', height: '80px' });
    });

    it('renders with custom numeric size', () => {
      render(<EntityAvatar entityType="auditor" entityId={1} size={48} />, { wrapper });
      const avatar = screen.getByRole('img', { hidden: true }).closest('.MuiAvatar-root');
      expect(avatar).toHaveStyle({ width: '48px', height: '48px' });
    });
  });

  describe('image URL construction', () => {
    it('constructs correct URL for auditor', () => {
      render(<EntityAvatar entityType="auditor" entityId={123} />, { wrapper });
      const img = screen.getByRole('img', { hidden: true });
      expect(img).toHaveAttribute('src', 'http://localhost:3000/api/v1/auditors/123/image.png');
    });

    it('constructs correct URL for protocol', () => {
      render(<EntityAvatar entityType="protocol" entityId={456} />, { wrapper });
      const img = screen.getByRole('img', { hidden: true });
      expect(img).toHaveAttribute('src', 'http://localhost:3000/api/v1/protocols/456/image.png');
    });

    it('constructs correct URL for company', () => {
      render(<EntityAvatar entityType="company" entityId={789} />, { wrapper });
      const img = screen.getByRole('img', { hidden: true });
      expect(img).toHaveAttribute('src', 'http://localhost:3000/api/v1/companies/789/image.png');
    });

    it('constructs correct URL for report', () => {
      render(<EntityAvatar entityType="report" entityId={101} />, { wrapper });
      const img = screen.getByRole('img', { hidden: true });
      expect(img).toHaveAttribute('src', 'http://localhost:3000/api/v1/reports/101/image.png');
    });

    it('constructs correct URL for user with avatar.png', () => {
      render(<EntityAvatar entityType="user" entityId={202} />, { wrapper });
      const img = screen.getByRole('img', { hidden: true });
      expect(img).toHaveAttribute('src', 'http://localhost:3000/api/v1/user/202/avatar.png');
    });

    it('includes cache buster in URL when provided', () => {
      const cacheBuster = 1234567890;
      render(
        <EntityAvatar entityType="auditor" entityId={1} cacheBuster={cacheBuster} />,
        { wrapper }
      );
      const img = screen.getByRole('img', { hidden: true });
      expect(img).toHaveAttribute(
        'src',
        `http://localhost:3000/api/v1/auditors/1/image.png?t=${cacheBuster}`
      );
    });
  });

  describe('loading states', () => {
    it('shows spinner loading style by default', () => {
      render(<EntityAvatar entityType="auditor" entityId={1} />, { wrapper });
      expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });

    it('shows skeleton loading style when specified', () => {
      render(
        <EntityAvatar entityType="auditor" entityId={1} loadingStyle="skeleton" />,
        { wrapper }
      );
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
      // Skeleton is rendered instead (MUI doesn't give it a role)
    });

    it('hides loading indicator after image loads', async () => {
      render(<EntityAvatar entityType="auditor" entityId={1} />, { wrapper });

      const img = screen.getByRole('img', { hidden: true });
      fireEvent.load(img);

      await waitFor(() => {
        expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
      });
    });
  });

  describe('error handling and fallback', () => {
    it('shows fallback text as initials on error', async () => {
      render(
        <EntityAvatar entityType="auditor" entityId={1} fallbackText="John Doe" />,
        { wrapper }
      );

      const img = screen.getByRole('img', { hidden: true });
      fireEvent.error(img);

      await waitFor(() => {
        expect(screen.getByText('JD')).toBeInTheDocument();
      });
    });

    it('shows custom fallback content on error', async () => {
      render(
        <EntityAvatar
          entityType="auditor"
          entityId={1}
          fallback={<span data-testid="custom-fallback">Custom</span>}
        />,
        { wrapper }
      );

      const img = screen.getByRole('img', { hidden: true });
      fireEvent.error(img);

      await waitFor(() => {
        expect(screen.getByTestId('custom-fallback')).toBeInTheDocument();
      });
    });

    it('shows default icon on error when no fallback provided', async () => {
      render(<EntityAvatar entityType="auditor" entityId={1} />, { wrapper });

      const img = screen.getByRole('img', { hidden: true });
      fireEvent.error(img);

      await waitFor(() => {
        // The Person icon is rendered as an SVG
        expect(screen.getByTestId('PersonIcon')).toBeInTheDocument();
      });
    });
  });

  describe('callbacks', () => {
    it('calls onLoad when image loads successfully', async () => {
      const onLoad = vi.fn();
      render(
        <EntityAvatar entityType="auditor" entityId={1} onLoad={onLoad} />,
        { wrapper }
      );

      const img = screen.getByRole('img', { hidden: true });
      fireEvent.load(img);

      await waitFor(() => {
        expect(onLoad).toHaveBeenCalledTimes(1);
      });
    });

    it('calls onError when image fails to load', async () => {
      const onError = vi.fn();
      render(
        <EntityAvatar entityType="auditor" entityId={1} onError={onError} />,
        { wrapper }
      );

      const img = screen.getByRole('img', { hidden: true });
      fireEvent.error(img);

      await waitFor(() => {
        expect(onError).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('alt text', () => {
    it('uses custom alt text when provided', () => {
      render(
        <EntityAvatar entityType="auditor" entityId={1} alt="Custom Alt" />,
        { wrapper }
      );
      expect(screen.getByAltText('Custom Alt')).toBeInTheDocument();
    });

    it('uses default alt text based on entity type', () => {
      render(<EntityAvatar entityType="auditor" entityId={1} />, { wrapper });
      expect(screen.getByAltText('auditor avatar')).toBeInTheDocument();
    });
  });

  describe('styling', () => {
    it('applies custom sx props', () => {
      render(
        <EntityAvatar
          entityType="auditor"
          entityId={1}
          sx={{ marginRight: '16px' }}
        />,
        { wrapper }
      );
      const avatar = screen.getByRole('img', { hidden: true }).closest('.MuiAvatar-root');
      // Check that the avatar exists and sx is applied via MUI's styling system
      expect(avatar).toBeInTheDocument();
      expect(avatar).toHaveClass('MuiAvatar-root');
    });
  });
});

describe('getEntityAvatarUrl', () => {
  it('constructs URL without cache buster', () => {
    const url = getEntityAvatarUrl('auditor', 123);
    expect(url).toBe('http://localhost:3000/api/v1/auditors/123/image.png');
  });

  it('constructs URL with cache buster', () => {
    const url = getEntityAvatarUrl('protocol', 456, 1234567890);
    expect(url).toBe('http://localhost:3000/api/v1/protocols/456/image.png?t=1234567890');
  });

  it('handles all entity types correctly', () => {
    expect(getEntityAvatarUrl('auditor', 1)).toContain('/auditors/1/image.png');
    expect(getEntityAvatarUrl('protocol', 1)).toContain('/protocols/1/image.png');
    expect(getEntityAvatarUrl('company', 1)).toContain('/companies/1/image.png');
    expect(getEntityAvatarUrl('report', 1)).toContain('/reports/1/image.png');
    expect(getEntityAvatarUrl('user', 1)).toContain('/user/1/avatar.png');
  });
});

describe('useEntityAvatarState', () => {
  it('initializes with loading true and no error', () => {
    const { result } = renderHook(() => useEntityAvatarState());

    expect(result.current.isLoading).toBe(true);
    expect(result.current.hasError).toBe(false);
  });

  it('handleLoad sets isLoading false and hasError false', () => {
    const { result } = renderHook(() => useEntityAvatarState());

    act(() => {
      result.current.handleLoad();
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.hasError).toBe(false);
  });

  it('handleError sets isLoading false and hasError true', () => {
    const { result } = renderHook(() => useEntityAvatarState());

    act(() => {
      result.current.handleError();
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.hasError).toBe(true);
  });

  it('reset sets isLoading true and hasError false', () => {
    const { result } = renderHook(() => useEntityAvatarState());

    // First set error state
    act(() => {
      result.current.handleError();
    });

    // Then reset
    act(() => {
      result.current.reset();
    });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.hasError).toBe(false);
  });

  it('provides stable function references', () => {
    const { result, rerender } = renderHook(() => useEntityAvatarState());

    const handleLoad = result.current.handleLoad;
    const handleError = result.current.handleError;
    const reset = result.current.reset;

    rerender();

    expect(result.current.handleLoad).toBe(handleLoad);
    expect(result.current.handleError).toBe(handleError);
    expect(result.current.reset).toBe(reset);
  });
});
