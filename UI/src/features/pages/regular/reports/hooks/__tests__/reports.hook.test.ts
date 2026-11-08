import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useReports } from '../reports.hook';
import * as api from '../../../../../../api/soroban-security-portal/soroban-security-portal-api';

vi.mock('../../../../../../api/soroban-security-portal/soroban-security-portal-api', () => ({
    getReportsCall: vi.fn(),
    getProtocolListDataCall: vi.fn(),
    getCompanyListDataCall: vi.fn(),
    getAuditorListDataCall: vi.fn(),
}));

describe('useReports', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(api.getReportsCall).mockResolvedValue([]);
        vi.mocked(api.getProtocolListDataCall).mockResolvedValue([]);
        vi.mocked(api.getCompanyListDataCall).mockResolvedValue([]);
        vi.mocked(api.getAuditorListDataCall).mockResolvedValue([]);
    });

    it('loads reports sorted by report date, newest first, on mount', async () => {
        renderHook(() => useReports());

        await waitFor(() => {
            expect(api.getReportsCall).toHaveBeenCalledTimes(1);
        });
        expect(api.getReportsCall).toHaveBeenCalledWith({ sortBy: 'date', sortDirection: 'desc' });
    });
});
