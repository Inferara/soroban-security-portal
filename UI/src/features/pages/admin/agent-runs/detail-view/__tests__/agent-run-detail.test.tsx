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

const processingRun = {
  id: 7, status: 'processing', sourceUrl: 'https://x/r2', model: 'claude', error: '', createdBy: 1, createdAt: 'd',
  promptVersion: '', articleMarkdown: '', transcript: 'Reading the report...',
  reportTitle: '', protocolName: '', auditorName: '', reportDate: '',
  findings: [],
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

  it('processing run: shows status chip, reasoning accordion, transcript text, no Approve button, no article TextField', () => {
    mockRun = processingRun;
    renderComponent();
    // Status chip
    expect(screen.getByText('processing')).toBeInTheDocument();
    // Agent reasoning accordion is present
    expect(screen.getByText('Agent reasoning')).toBeInTheDocument();
    // Transcript text is rendered
    expect(screen.getByText(/Reading the report/)).toBeInTheDocument();
    // No Approve selected button
    expect(screen.queryByRole('button', { name: /Approve selected/i })).not.toBeInTheDocument();
    // No article TextField (multiline editor)
    expect(screen.queryByLabelText('Article (Markdown)')).not.toBeInTheDocument();
  });

  it('succeeded run: renders the editable form and Approve selected button', () => {
    mockRun = succeededRun;
    renderComponent();
    expect(screen.getByRole('button', { name: /Approve selected/i })).toBeInTheDocument();
    expect(screen.getByLabelText('Article (Markdown)')).toBeInTheDocument();
  });

  it('transcript text appears for a succeeded run with a transcript', () => {
    mockRun = { ...succeededRun, transcript: 'Agent thought process here' };
    renderComponent();
    // The transcript is rendered via MarkdownView inside the accordion
    expect(screen.getByText(/Agent thought process here/)).toBeInTheDocument();
  });
});
