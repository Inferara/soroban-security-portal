import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { DetailPageLayout } from '../DetailPageLayout';

const theme = createTheme();

// Mock navigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <MemoryRouter>
    <ThemeProvider theme={theme}>{children}</ThemeProvider>
  </MemoryRouter>
);

describe('DetailPageLayout', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
  });

  describe('loading state', () => {
    it('displays loading spinner when loading is true', () => {
      render(
        <DetailPageLayout
          loading={true}
          error={null}
          entity={null}
          entityName="Auditor"
        >
          <div>Content</div>
        </DetailPageLayout>,
        { wrapper }
      );

      expect(screen.getByRole('status')).toBeInTheDocument();
      expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });

    it('shows correct aria-label for loading state', () => {
      render(
        <DetailPageLayout
          loading={true}
          error={null}
          entity={null}
          entityName="Company"
        >
          <div>Content</div>
        </DetailPageLayout>,
        { wrapper }
      );

      expect(screen.getByRole('status')).toHaveAttribute(
        'aria-label',
        'Loading company details'
      );
    });

    it('does not render children when loading', () => {
      render(
        <DetailPageLayout
          loading={true}
          error={null}
          entity={{ id: 1 }}
          entityName="Auditor"
        >
          <div data-testid="content">Content</div>
        </DetailPageLayout>,
        { wrapper }
      );

      expect(screen.queryByTestId('content')).not.toBeInTheDocument();
    });
  });

  describe('error state', () => {
    it('displays error message when error is provided', () => {
      render(
        <DetailPageLayout
          loading={false}
          error="Failed to load data"
          entity={null}
          entityName="Auditor"
        >
          <div>Content</div>
        </DetailPageLayout>,
        { wrapper }
      );

      expect(screen.getByText('Failed to load data')).toBeInTheDocument();
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    it('displays "not found" message when entity is null', () => {
      render(
        <DetailPageLayout
          loading={false}
          error={null}
          entity={null}
          entityName="Protocol"
        >
          <div>Content</div>
        </DetailPageLayout>,
        { wrapper }
      );

      expect(screen.getByText('Protocol not found')).toBeInTheDocument();
    });

    it('displays "not found" message when entity is undefined', () => {
      render(
        <DetailPageLayout
          loading={false}
          error={null}
          entity={undefined}
          entityName="Report"
        >
          <div>Content</div>
        </DetailPageLayout>,
        { wrapper }
      );

      expect(screen.getByText('Report not found')).toBeInTheDocument();
    });

    it('shows back button in error state', () => {
      render(
        <DetailPageLayout
          loading={false}
          error="Error"
          entity={null}
          entityName="Auditor"
        >
          <div>Content</div>
        </DetailPageLayout>,
        { wrapper }
      );

      expect(screen.getByRole('button', { name: /back/i })).toBeInTheDocument();
    });
  });

  describe('navigation', () => {
    it('navigates back when back button is clicked', () => {
      render(
        <DetailPageLayout
          loading={false}
          error="Error"
          entity={null}
          entityName="Auditor"
        >
          <div>Content</div>
        </DetailPageLayout>,
        { wrapper }
      );

      fireEvent.click(screen.getByRole('button', { name: /back/i }));
      expect(mockNavigate).toHaveBeenCalledWith(-1);
    });

    it('calls custom onBack handler when provided', () => {
      const onBack = vi.fn();
      render(
        <DetailPageLayout
          loading={false}
          error="Error"
          entity={null}
          entityName="Auditor"
          onBack={onBack}
        >
          <div>Content</div>
        </DetailPageLayout>,
        { wrapper }
      );

      fireEvent.click(screen.getByRole('button', { name: /back/i }));
      expect(onBack).toHaveBeenCalled();
      expect(mockNavigate).not.toHaveBeenCalled();
    });

    it('navigates to fallback path when provided', () => {
      render(
        <DetailPageLayout
          loading={false}
          error="Error"
          entity={null}
          entityName="Auditor"
          fallbackPath="/auditors"
        >
          <div>Content</div>
        </DetailPageLayout>,
        { wrapper }
      );

      fireEvent.click(screen.getByRole('button', { name: /back/i }));
      expect(mockNavigate).toHaveBeenCalledWith('/auditors');
    });
  });

  describe('success state', () => {
    it('renders children when entity is loaded', () => {
      render(
        <DetailPageLayout
          loading={false}
          error={null}
          entity={{ id: 1, name: 'Test Auditor' }}
          entityName="Auditor"
        >
          <div data-testid="content">Test Content</div>
        </DetailPageLayout>,
        { wrapper }
      );

      expect(screen.getByTestId('content')).toBeInTheDocument();
      expect(screen.getByText('Test Content')).toBeInTheDocument();
    });

    it('applies default maxWidth', () => {
      const { container } = render(
        <DetailPageLayout
          loading={false}
          error={null}
          entity={{ id: 1 }}
          entityName="Auditor"
        >
          <div>Content</div>
        </DetailPageLayout>,
        { wrapper }
      );

      const contentBox = container.querySelector('.MuiBox-root');
      expect(contentBox).toBeInTheDocument();
    });

    it('renders multiple children correctly', () => {
      render(
        <DetailPageLayout
          loading={false}
          error={null}
          entity={{ id: 1 }}
          entityName="Auditor"
        >
          <div data-testid="child1">Child 1</div>
          <div data-testid="child2">Child 2</div>
          <div data-testid="child3">Child 3</div>
        </DetailPageLayout>,
        { wrapper }
      );

      expect(screen.getByTestId('child1')).toBeInTheDocument();
      expect(screen.getByTestId('child2')).toBeInTheDocument();
      expect(screen.getByTestId('child3')).toBeInTheDocument();
    });
  });

  describe('priority handling', () => {
    it('prioritizes loading over error', () => {
      render(
        <DetailPageLayout
          loading={true}
          error="Error message"
          entity={null}
          entityName="Auditor"
        >
          <div>Content</div>
        </DetailPageLayout>,
        { wrapper }
      );

      expect(screen.getByRole('progressbar')).toBeInTheDocument();
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('shows error when not loading and entity is null with error', () => {
      render(
        <DetailPageLayout
          loading={false}
          error="Specific error"
          entity={null}
          entityName="Auditor"
        >
          <div>Content</div>
        </DetailPageLayout>,
        { wrapper }
      );

      expect(screen.getByText('Specific error')).toBeInTheDocument();
    });
  });
});
