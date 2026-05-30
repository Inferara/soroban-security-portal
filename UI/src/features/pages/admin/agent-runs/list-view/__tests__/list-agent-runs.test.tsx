import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { AgentRunManagement } from '../list-agent-runs';
import currentPageReducer from '../../../admin-main-window/current-page-slice';

const mockNavigate = vi.fn();
const mockReject = vi.fn();
const mockRerun = vi.fn();
let mockRuns: unknown[] = [];

vi.mock('../hooks', () => ({
  useListAgentRuns: () => ({
    agentRuns: mockRuns,
    reject: mockReject,
    rerun: mockRerun,
    refresh: vi.fn(),
  }),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

const theme = createTheme();
const renderComponent = () => {
  const store = configureStore({ reducer: { currentPage: currentPageReducer } });
  return render(
    <Provider store={store}>
      <ThemeProvider theme={theme}>
        <MemoryRouter><AgentRunManagement /></MemoryRouter>
      </ThemeProvider>
    </Provider>
  );
};

describe('AgentRunManagement', () => {
  beforeEach(() => { vi.clearAllMocks(); mockRuns = []; });

  it('renders a row per run and a New agent run button', () => {
    mockRuns = [{ id: 1, status: 'succeeded', sourceUrl: 'https://x/r', model: 'claude', createdAt: '2026-05-29T00:00:00', error: '', createdBy: 1 }];
    renderComponent();
    expect(screen.getByText('New agent run')).toBeInTheDocument();
    expect(screen.getByText('https://x/r')).toBeInTheDocument();
  });

  it('view navigates to the detail page', () => {
    mockRuns = [{ id: 9, status: 'failed', sourceUrl: 's', model: 'm', createdAt: 'd', error: '', createdBy: 1 }];
    renderComponent();
    fireEvent.click(screen.getByLabelText('View run'));
    expect(mockNavigate).toHaveBeenCalledWith('/admin/agent-runs/detail?runId=9');
  });

  // ── New test per reviewer feedback ────────────────────────────────────────

  it('Created column formats ISO datetime to YYYY-MM-DD HH:mm and does not show raw milliseconds', () => {
    const rawIso = '2026-05-30T10:42:59.98516';
    mockRuns = [{ id: 2, status: 'succeeded', sourceUrl: 'https://x/r', model: 'claude', createdAt: rawIso, error: '', createdBy: 1 }];
    renderComponent();
    // Raw string with milliseconds must not appear
    expect(screen.queryByText(rawIso)).not.toBeInTheDocument();
    // Formatted value — strips fractional seconds via split('.')[0] then replaces T with space
    expect(screen.getByText('2026-05-30 10:42:59')).toBeInTheDocument();
  });

  it('Model column shows the model value, with em-dash fallback when empty', () => {
    mockRuns = [
      { id: 3, status: 'queued', sourceUrl: 'u', model: 'claude-sonnet', createdAt: '2026-05-30T00:00:00', error: '', createdBy: 1 },
      { id: 4, status: 'queued', sourceUrl: 'v', model: '', createdAt: '2026-05-30T00:00:00', error: '', createdBy: 1 },
    ];
    renderComponent();
    expect(screen.getByText('claude-sonnet')).toBeInTheDocument();
    // The em-dash fallback for the empty model
    const emDashes = screen.getAllByText('—');
    expect(emDashes.length).toBeGreaterThan(0);
  });
});
