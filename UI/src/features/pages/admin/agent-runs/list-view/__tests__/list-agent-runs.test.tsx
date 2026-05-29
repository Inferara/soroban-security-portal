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
});
