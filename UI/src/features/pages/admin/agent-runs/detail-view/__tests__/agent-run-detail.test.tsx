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
    protocolsList: [{ id: 1, name: 'Rozo', url: '', date: new Date(), createdBy: '' }],
    auditorsList: [{ id: 1, name: 'Hacken', description: '', url: '', date: new Date(), createdBy: '' }],
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
  reportPdfUrl: 'https://x/rozo.pdf',
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

    // Both findings are included by default; uncheck the first one.
    // In the new accordion design the checkbox aria-label is "Include finding 0"
    const firstCheckbox = screen.getByRole('checkbox', { name: /Include finding 0/i });
    fireEvent.click(firstCheckbox);

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

  it('transcript text appears for a succeeded run with a transcript (reasoning accordion open by default)', () => {
    mockRun = { ...succeededRun, transcript: 'Agent thought process here' };
    renderComponent();
    // The transcript is rendered via MarkdownView inside the accordion which is open by default
    expect(screen.getByText(/Agent thought process here/)).toBeInTheDocument();
  });

  // ── New tests per reviewer feedback ──────────────────────────────────────

  it('source URL renders as a clickable link with the correct href', () => {
    mockRun = succeededRun;
    renderComponent();
    const link = screen.getByRole('link', { name: succeededRun.sourceUrl });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', succeededRun.sourceUrl);
  });

  it('audit date input is type=date and shows only the date portion', () => {
    mockRun = succeededRun;
    renderComponent();
    // The date field should be type=date and contain just YYYY-MM-DD
    const dateInput = screen.getByDisplayValue('2026-01-01');
    expect(dateInput).toHaveAttribute('type', 'date');
  });

  it('finding accordion summary shows title and severity chip, details are in an Accordion', () => {
    mockRun = succeededRun;
    renderComponent();
    // Title visible in the accordion summary (not just in an input)
    const titles = screen.getAllByText('Reentrancy');
    // At least one instance (summary text + may also be in input when expanded)
    expect(titles.length).toBeGreaterThan(0);
    // Severity chips appear (use getAllByText since the Select combobox also renders the value)
    expect(screen.getAllByText('high').length).toBeGreaterThan(0);
    expect(screen.getAllByText('medium').length).toBeGreaterThan(0);
    // Category labels appear (use getAllByText since Select combobox also renders the value)
    expect(screen.getAllByText('Valid (not fixed)').length).toBeGreaterThan(0);
  });

  it('reasoning accordion is expanded by default on a succeeded run — transcript visible without interaction', () => {
    mockRun = { ...succeededRun, transcript: 'thinking...' };
    renderComponent();
    // Should be visible immediately without clicking to expand
    expect(screen.getByText(/thinking\.\.\./)).toBeInTheDocument();
  });

  it('approve-subset: unchecking first finding leaves second in payload', async () => {
    mockRun = succeededRun;
    renderComponent();

    // Uncheck finding 0 via aria-label
    const cb0 = screen.getByRole('checkbox', { name: /Include finding 0/i });
    fireEvent.click(cb0);

    fireEvent.click(screen.getByRole('button', { name: /Approve selected/i }));

    await waitFor(() => expect(mockApprove).toHaveBeenCalled());
    const payload = mockApprove.mock.calls[0][0];
    expect(payload.findings.length).toBe(1);
    expect(payload.findings[0].title).toBe('Integer Overflow');
  });

  it('Report PDF URL field renders pre-filled with the run value', () => {
    mockRun = succeededRun;
    renderComponent();
    expect(screen.getByDisplayValue('https://x/rozo.pdf')).toBeInTheDocument();
    expect(screen.getByLabelText('Report PDF URL')).toBeInTheDocument();
  });

  it('approve payload includes reportPdfUrl with the pre-filled value', async () => {
    mockRun = succeededRun;
    renderComponent();

    fireEvent.click(screen.getByRole('button', { name: /Approve selected/i }));

    await waitFor(() => expect(mockApprove).toHaveBeenCalled());
    const payload = mockApprove.mock.calls[0][0];
    expect(payload.reportPdfUrl).toBe('https://x/rozo.pdf');
  });

  it('approve payload includes updated reportPdfUrl after editing', async () => {
    mockRun = succeededRun;
    renderComponent();

    const pdfUrlInput = screen.getByLabelText('Report PDF URL');
    fireEvent.change(pdfUrlInput, { target: { value: 'https://new/report.pdf' } });

    fireEvent.click(screen.getByRole('button', { name: /Approve selected/i }));

    await waitFor(() => expect(mockApprove).toHaveBeenCalled());
    const payload = mockApprove.mock.calls[0][0];
    expect(payload.reportPdfUrl).toBe('https://new/report.pdf');
  });

  // ── Protocol / Auditor Autocompletes (reviewer: vulnerabilities weren't linked) ──

  it('protocol and auditor render as comboboxes pre-filled from the run', () => {
    mockRun = succeededRun;
    renderComponent();
    // Autocomplete renders a combobox input; pre-filled from run.protocolName / run.auditorName
    expect(screen.getByDisplayValue('MyProtocol')).toBeInTheDocument();
    expect(screen.getByDisplayValue('AuditCo')).toBeInTheDocument();
    const protocolInput = screen.getByLabelText('Protocol / project');
    expect(protocolInput).toHaveAttribute('role', 'combobox');
  });

  it('approve payload carries protocol/auditor names so the backend links them', async () => {
    mockRun = succeededRun;
    renderComponent();

    fireEvent.click(screen.getByRole('button', { name: /Approve selected/i }));

    await waitFor(() => expect(mockApprove).toHaveBeenCalled());
    const payload = mockApprove.mock.calls[0][0];
    expect(payload.protocolName).toBe('MyProtocol');
    expect(payload.auditorName).toBe('AuditCo');
  });

  it('editing the protocol field flows into the approve payload', async () => {
    mockRun = succeededRun;
    renderComponent();

    const protocolInput = screen.getByLabelText('Protocol / project');
    fireEvent.change(protocolInput, { target: { value: 'Rozo' } });

    fireEvent.click(screen.getByRole('button', { name: /Approve selected/i }));

    await waitFor(() => expect(mockApprove).toHaveBeenCalled());
    const payload = mockApprove.mock.calls[0][0];
    expect(payload.protocolName).toBe('Rozo');
  });

  // ── Live link-status feedback ────────────────────────────────────────────

  it('shows "will be created" when the typed protocol/auditor does not match an existing entity', () => {
    // succeededRun pre-fills protocolName='MyProtocol' / auditorName='AuditCo', neither of which
    // is in the mocked lists (Rozo / Hacken) → both should report they will be created.
    mockRun = succeededRun;
    renderComponent();
    expect(screen.getByText(/a new protocol "MyProtocol" will be created/i)).toBeInTheDocument();
    expect(screen.getByText(/a new auditor "AuditCo" will be created/i)).toBeInTheDocument();
  });

  it('shows "links to existing" when the typed protocol matches an existing entity', () => {
    mockRun = succeededRun;
    renderComponent();
    const protocolInput = screen.getByLabelText('Protocol / project');
    fireEvent.change(protocolInput, { target: { value: 'Rozo' } });
    expect(screen.getByText(/Links to existing protocol "Rozo"/i)).toBeInTheDocument();
  });

  it('warns that vulnerabilities will be unlinked when protocol is left blank', () => {
    mockRun = { ...succeededRun, protocolName: '' };
    renderComponent();
    expect(screen.getByText(/No protocol — approved vulnerabilities won't be linked/i)).toBeInTheDocument();
  });
});
