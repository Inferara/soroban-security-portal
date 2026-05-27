import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { usePageViewTracking } from '../usePageViewTracking';
import { PageViewEntityType } from '../../api/soroban-security-portal/models/analytics';
import * as api from '../../api/soroban-security-portal/soroban-security-portal-api';

vi.mock('../../api/soroban-security-portal/soroban-security-portal-api', () => ({
  recordPageViewCall: vi.fn(),
  getPageViewCountCall: vi.fn(),
}));

describe('usePageViewTracking', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (api.recordPageViewCall as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
    (api.getPageViewCountCall as ReturnType<typeof vi.fn>).mockResolvedValue({ total: 11, unique: 7 });
  });

  it('records once and returns the count', async () => {
    const { result } = renderHook(() => usePageViewTracking(PageViewEntityType.Report, 9));
    await waitFor(() => expect(result.current).toEqual({ total: 11, unique: 7 }));
    expect(api.recordPageViewCall).toHaveBeenCalledTimes(1);
    expect(api.recordPageViewCall).toHaveBeenCalledWith(PageViewEntityType.Report, 9);
  });

  it('does nothing for an undefined id', async () => {
    renderHook(() => usePageViewTracking(PageViewEntityType.Report, undefined));
    expect(api.recordPageViewCall).not.toHaveBeenCalled();
  });
});
