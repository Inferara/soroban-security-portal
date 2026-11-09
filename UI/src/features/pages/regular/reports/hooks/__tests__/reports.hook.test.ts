import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useReports } from '../reports.hook';
import * as api from '../../../../../../api/soroban-security-portal/soroban-security-portal-api';
import { Report } from '../../../../../../api/soroban-security-portal/models/report';

vi.mock('../../../../../../api/soroban-security-portal/soroban-security-portal-api', () => ({
    getReportsCall: vi.fn(),
    getProtocolListDataCall: vi.fn(),
    getCompanyListDataCall: vi.fn(),
    getAuditorListDataCall: vi.fn(),
}));

const report = (id: number, date: string): Report => ({ id, name: `Report ${id}`, date } as Report);

const deferred = <T,>() => {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>(res => { resolve = res; });
    return { promise, resolve };
};

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

    it('ignores a response from an earlier search that arrives after a later one', async () => {
        const initial = deferred<Report[]>();
        const ascending = deferred<Report[]>();
        const descending = deferred<Report[]>();
        vi.mocked(api.getReportsCall)
            .mockReturnValueOnce(initial.promise)
            .mockReturnValueOnce(ascending.promise)
            .mockReturnValueOnce(descending.promise);

        const { result } = renderHook(() => useReports());
        await waitFor(() => {
            expect(api.getReportsCall).toHaveBeenCalledTimes(1);
        });

        // User toggles the sort twice: asc, then back to desc.
        act(() => {
            void result.current.searchReports({ sortBy: 'date', sortDirection: 'asc' });
            void result.current.searchReports({ sortBy: 'date', sortDirection: 'desc' });
        });
        expect(api.getReportsCall).toHaveBeenCalledTimes(3);

        // The latest (descending) request answers first.
        const newestFirst = [report(2, '2026-08-01'), report(1, '2023-12-01')];
        await act(async () => {
            descending.resolve(newestFirst);
        });
        expect(result.current.reportsList).toEqual(newestFirst);

        // Earlier requests answer late and must not overwrite the list.
        await act(async () => {
            ascending.resolve([report(1, '2023-12-01'), report(2, '2026-08-01')]);
            initial.resolve([report(3, '2025-01-01')]);
        });
        expect(result.current.reportsList).toEqual(newestFirst);
    });
});
