import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { AgentRunDetail } from '../agent-run-detail';
import currentPageReducer from '../../../admin-main-window/current-page-slice';

const mockNavigate = vi.fn();
const mockApprove = vi.fn().mockResolvedValue(true);
const mockReject = vi.fn().mockResolvedValue(true);
const mockRerun = vi.fn().mockResolvedValue(true);
let mockRun: unknown = undefined;
let mockRunId: number | undefined = 5;

vi.mock('../hooks', () => ({
  useAgentRunDetail: () => ({
    runId: mockRunId, run: mockRun,
    approve: mockApprove, reject: mockReject, rerun: mockRerun, enqueue: vi.fn().mockResolvedValue(true),
  }),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

const theme = createTheme();
const renderComponent = () => render(
  <Provider store={configureStore({ reducer: { currentPage: currentPageReducer } })}>
    <ThemeProvider theme={theme}><MemoryRouter><AgentRunDetail /></MemoryRouter></ThemeProvider>
  </Provider>
);

const succeededRun = {
  id: 5, status: 'succeeded', sourceUrl: 'https://x/r', model: 'claude', error: '', createdBy: 1, createdAt: 'd',
  promptVersion: '', articleMarkdown: '# Audit', transcript: 'thinking...',
  reportTitle: 'My Audit Report', protocolName: 'MyProtocol', auditorName: 'AuditCo', reportDate: '2026-01-01',
  findings: [
    { title: 'Reentrancy', description: 'desc1', severity: 'high', tags: ['t1'], category: 0 },
    { title: 'Integer Overflow', description: 'desc2', severity: 'medium', tags: ['t2'], category: 1 },
  ],
  findingsUnparseable: false,
};

describe('AgentRunDetail', () => {
  beforeEach(() => { vi.clearAllMocks(); mockRunId = 5; mockRun = undefined; });

  it('shows loading while run is undefined', () => {
    mockRun = undefined;
    renderComponent();
    expect(screen.getByText('Loading run...')).toBeInTheDocument();
  });

  it('renders editable fields pre-filled from the run', () => {
    mockRun = succeededRun;
    renderComponent();
    // Article textarea should contain the run's articleMarkdown
    expect(screen.getByDisplayValue('# Audit')).toBeInTheDocument();
    // First finding title should be visible in an input
    expect(screen.getByDisplayValue('Reentrancy')).toBeInTheDocument();
    // Report title field
    expect(screen.getByDisplayValue('My Audit Report')).toBeInTheDocument();
  });

  it('Approve selected excludes unchecked findings and navigates on success', async () => {
    mockRun = succeededRun;
    renderComponent();

    // Both findings are included by default; uncheck the first one
    const checkboxes = screen.getAllByRole('checkbox');
    // checkboxes[0] is the first finding's include checkbox
    fireEvent.click(checkboxes[0]);

    // Click approve
    const approveBtn = screen.getByRole('button', { name: /Approve selected/i });
    fireEvent.click(approveBtn);

    await waitFor(() => expect(mockApprove).toHaveBeenCalled());

    // The payload passed to approve should have only 1 finding (the second one)
    const payload = mockApprove.mock.calls[0][0];
    expect(payload.findings.length).toBe(1);
    expect(payload.findings[0].title).toBe('Integer Overflow');

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/admin/agent-runs'));
  });

  it('warns when findings are unparseable', () => {
    mockRun = { ...succeededRun, findings: [], findingsUnparseable: true };
    renderComponent();
    expect(screen.getByText(/could not be parsed/)).toBeInTheDocument();
  });

  it('shows the enqueue form when there is no runId', () => {
    mockRunId = undefined;
    mockRun = null;
    renderComponent();
    expect(screen.getByText('New agent run')).toBeInTheDocument();
    expect(screen.getByLabelText('Report source URL')).toBeInTheDocument();
  });
});
