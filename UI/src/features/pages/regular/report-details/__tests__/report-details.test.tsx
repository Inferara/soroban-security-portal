import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { BrowserRouter } from 'react-router-dom';
import { ReportDetails } from '../report-details';
import { VulnerabilityCategory } from '../../../../../api/soroban-security-portal/models/vulnerability';

// Mock the hooks and dependencies
vi.mock('../hooks/report-details.hook', () => ({
  useReportDetails: () => ({
    report: {
      id: 1,
      name: 'Test Report',
      date: new Date('2024-01-01'),
      protocolId: 1,
      auditorId: 1,
      companyId: 1,
    },
    protocol: { id: 1, name: 'Test Protocol' },
    auditor: { id: 1, name: 'Test Auditor' },
    company: { id: 1, name: 'Test Company' },
    vulnerabilities: [
      {
        id: 1,
        title: 'Vuln 1',
        description: 'Test',
        severity: 'critical',
        category: VulnerabilityCategory.Valid,
        tags: [],
        companyName: 'Test',
        companyId: 1,
        protocolName: 'Test',
        protocolId: 1,
        auditorName: 'Test',
        auditorId: 1,
        reportName: 'Test',
        reportId: 1,
        picturesContainerGuid: '',
        date: new Date(),
        status: 'active',
      },
      {
        id: 2,
        title: 'Vuln 2',
        description: 'Test',
        severity: 'high',
        category: VulnerabilityCategory.ValidNotFixed,
        tags: [],
        companyName: 'Test',
        companyId: 1,
        protocolName: 'Test',
        protocolId: 1,
        auditorName: 'Test',
        auditorId: 1,
        reportName: 'Test',
        reportId: 1,
        picturesContainerGuid: '',
        date: new Date(),
        status: 'active',
      },
    ],
    statistics: {
      totalVulnerabilities: 2,
      severityBreakdown: { critical: 1, high: 1 },
      vulnerabilitiesByCategory: { 0: 1, 1: 1 },
    },
    loading: false,
    error: null,
    reportId: 1,
    pdfBlobUrl: null,
    pdfLoading: false,
    pdfLoadError: false,
    fetchPdfForViewing: vi.fn(),
    retryPdfLoad: vi.fn(),
  }),
}));

vi.mock('../../../comments/DiscussionPanel', () => ({
  DiscussionPanel: () => <div>Discussion Panel</div>,
}));

vi.mock('../../../../../contexts/BookmarkContext', () => ({
  useBookmarks: () => ({
    isBookmarked: () => false,
    toggleBookmark: vi.fn(),
  }),
}));

vi.mock('../../../authentication/useAppAuth', () => ({
  useAppAuth: () => ({
    auth: {
      isAuthenticated: false,
      user: null,
    },
  }),
}));

vi.mock('../../../dialog-handler/dialog-handler', () => ({
  showMessage: vi.fn(),
}));

vi.mock('../../../../hooks/usePageViewTracking', () => ({
  usePageViewTracking: () => 0,
}));

vi.mock('../../../../api/soroban-security-portal/soroban-security-portal-api', () => ({
  downloadReportPDF: vi.fn(),
  getCommentCountCall: vi.fn().mockResolvedValue(0),
}));

vi.mock('react-ga4', () => ({
  default: {
    event: vi.fn(),
  },
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useParams: () => ({ id: '1' }),
    useNavigate: () => vi.fn(),
  };
});

describe('ReportDetails - Category Filter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders category filter buttons', () => {
    render(
      <BrowserRouter>
        <ReportDetails />
      </BrowserRouter>
    );

    // Check if the filter label is present
    expect(screen.getByText('Filter by Status:')).toBeInTheDocument();

    // Check if all category buttons are rendered
    expect(screen.getByRole('button', { name: /Valid \(Fixed\)/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Valid \(Not Fixed\)/ })).toBeInTheDocument();
  });

  it('shows all vulnerabilities by default', async () => {
    render(
      <BrowserRouter>
        <ReportDetails />
      </BrowserRouter>
    );

    await waitFor(() => {
      // Both vulnerabilities should be visible
      expect(screen.getByText('Vuln 1')).toBeInTheDocument();
      expect(screen.getByText('Vuln 2')).toBeInTheDocument();
    });
  });

  it('filters vulnerabilities when category button is clicked', async () => {
    render(
      <BrowserRouter>
        <ReportDetails />
      </BrowserRouter>
    );

    const validNotFixedButton = screen.getByRole('button', { name: /Valid \(Not Fixed\)/ });

    // Click to deselect "Valid (Not Fixed)"
    fireEvent.click(validNotFixedButton);

    await waitFor(() => {
      // Only "Vuln 1" (Valid/Fixed) should be visible
      expect(screen.getByText('Vuln 1')).toBeInTheDocument();
      expect(screen.queryByText('Vuln 2')).not.toBeInTheDocument();
    });
  });

  it('updates vulnerability count when filtering', async () => {
    render(
      <BrowserRouter>
        <ReportDetails />
      </BrowserRouter>
    );

    // Check initial count
    await waitFor(() => {
      expect(screen.getByText(/Vulnerabilities \(2\)/)).toBeInTheDocument();
    });

    const validNotFixedButton = screen.getByRole('button', { name: /Valid \(Not Fixed\)/ });
    fireEvent.click(validNotFixedButton);

    // Check updated count
    await waitFor(() => {
      expect(screen.getByText(/Vulnerabilities \(1\)/)).toBeInTheDocument();
    });
  });

  it('allows multiple category selections', async () => {
    render(
      <BrowserRouter>
        <ReportDetails />
      </BrowserRouter>
    );

    const validFixedButton = screen.getByRole('button', { name: /Valid \(Fixed\)/ });
    const validNotFixedButton = screen.getByRole('button', { name: /Valid \(Not Fixed\)/ });

    // Deselect both
    fireEvent.click(validFixedButton);
    fireEvent.click(validNotFixedButton);

    await waitFor(() => {
      // No vulnerabilities should be visible
      expect(screen.queryByText('Vuln 1')).not.toBeInTheDocument();
      expect(screen.queryByText('Vuln 2')).not.toBeInTheDocument();
      expect(screen.getByText('No vulnerabilities found in this report')).toBeInTheDocument();
    });
  });

  it('re-selects hidden vulnerabilities when clicking category again', async () => {
    render(
      <BrowserRouter>
        <ReportDetails />
      </BrowserRouter>
    );

    const validNotFixedButton = screen.getByRole('button', { name: /Valid \(Not Fixed\)/ });

    // Deselect
    fireEvent.click(validNotFixedButton);
    await waitFor(() => {
      expect(screen.queryByText('Vuln 2')).not.toBeInTheDocument();
    });

    // Re-select
    fireEvent.click(validNotFixedButton);
    await waitFor(() => {
      expect(screen.getByText('Vuln 2')).toBeInTheDocument();
    });
  });
});
