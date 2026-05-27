import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { MemoryRouter } from 'react-router-dom';
import currentPageReducer from '../../admin-main-window/current-page-slice';
import { Statistics } from '../statistics';
import * as api from '../../../../../api/soroban-security-portal/soroban-security-portal-api';

vi.mock('../../../../../api/soroban-security-portal/soroban-security-portal-api', () => ({
  getAnalyticsStatisticsCall: vi.fn(),
}));

const renderPage = () => {
  const store = configureStore({ reducer: { currentPage: currentPageReducer } });
  return render(
    <Provider store={store}>
      <MemoryRouter>
        <ThemeProvider theme={createTheme()}>
          <Statistics />
        </ThemeProvider>
      </MemoryRouter>
    </Provider>
  );
};

describe('Statistics page', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders cards and top content from the API', async () => {
    (api.getAnalyticsStatisticsCall as ReturnType<typeof vi.fn>).mockResolvedValue({
      totalHumanViews: 100, uniqueVisitors: 60, crawlerShares: 8,
      topEntities: [{ entityType: 3, entityId: 1, title: 'Acme Audit', views: 40 }],
      daily: [{ date: '2026-05-26', views: 10 }, { date: '2026-05-27', views: 20 }],
    });

    renderPage();

    await waitFor(() => expect(screen.getByText('Acme Audit')).toBeInTheDocument());
    expect(screen.getByText('100')).toBeInTheDocument();
    expect(screen.getByText('Unique Visitors')).toBeInTheDocument();
    expect(screen.getByText('Link-Preview Shares')).toBeInTheDocument();
  });
});
