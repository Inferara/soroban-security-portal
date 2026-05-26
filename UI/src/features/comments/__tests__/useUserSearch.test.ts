import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useUserSearch } from '../useUserSearch';

vi.mock('../../../api/soroban-security-portal/soroban-security-portal-api', () => ({
  searchUsersCall: vi.fn().mockResolvedValue([{ id: 1, displayName: 'Alice', username: 'alice' }]),
}));
import { searchUsersCall } from '../../../api/soroban-security-portal/soroban-security-portal-api';

describe('useUserSearch', () => {
  beforeEach(() => { vi.useFakeTimers(); (searchUsersCall as ReturnType<typeof vi.fn>).mockClear(); });
  afterEach(() => { vi.useRealTimers(); });

  it('does not search below minLength', () => {
    renderHook(() => useUserSearch('', 1));
    vi.advanceTimersByTime(400);
    expect(searchUsersCall).not.toHaveBeenCalled();
  });

  it('debounces and searches after 300ms', async () => {
    const { result } = renderHook(({ q }) => useUserSearch(q, 1), { initialProps: { q: 'al' } });
    vi.advanceTimersByTime(299);
    expect(searchUsersCall).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(searchUsersCall).toHaveBeenCalledWith('al');
    // flush resolved promise + React state update inside act so the state lands
    await act(async () => {
      await vi.runAllTimersAsync();
    });
    expect(result.current).toHaveLength(1);
  });

  it('debounce cancels the prior pending search on rapid change', () => {
    const { rerender } = renderHook(({ q }) => useUserSearch(q, 1), { initialProps: { q: 'a' } });
    vi.advanceTimersByTime(100);
    rerender({ q: 'al' });
    vi.advanceTimersByTime(100);
    rerender({ q: 'ali' });
    vi.advanceTimersByTime(300);
    expect(searchUsersCall).toHaveBeenCalledTimes(1);
    expect(searchUsersCall).toHaveBeenCalledWith('ali');
  });
});
