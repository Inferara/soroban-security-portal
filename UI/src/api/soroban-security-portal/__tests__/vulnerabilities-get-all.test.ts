import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockRequest = vi.fn();
vi.mock('../../rest-api', () => {
  const MockRestApi = function () { return { request: mockRequest }; };
  return { default: MockRestApi };
});
vi.mock('../../../environments/environment', () => ({
  environment: { apiUrl: 'http://localhost', clientId: 'test-client' },
}));
Object.defineProperty(globalThis, 'localStorage', {
  value: { getItem: vi.fn().mockReturnValue(null) },
  writable: true,
});

import { getAllVulnerabilitiesCall, VULNERABILITY_SEARCH_MAX_PAGE_SIZE } from '../soroban-security-portal-api';

const rows = (from: number, count: number) => Array.from({ length: count }, (_, i) => ({ id: from + i }));

beforeEach(() => {
  mockRequest.mockReset();
});

describe('getAllVulnerabilitiesCall', () => {
  it('walks the paged endpoint in max-size pages until the total is reached', async () => {
    const total = 2 * VULNERABILITY_SEARCH_MAX_PAGE_SIZE + 37;
    mockRequest
      .mockResolvedValueOnce({ data: rows(1, 100), headers: { 'x-total-count': String(total) } })
      .mockResolvedValueOnce({ data: rows(101, 100), headers: { 'x-total-count': String(total) } })
      .mockResolvedValueOnce({ data: rows(201, 37), headers: { 'x-total-count': String(total) } });

    const result = await getAllVulnerabilitiesCall({ auditorIds: [7] });

    expect(result).toHaveLength(total);
    expect(result[0].id).toBe(1);
    expect(result[total - 1].id).toBe(total);
    expect(mockRequest).toHaveBeenCalledTimes(3);
    for (let i = 0; i < 3; i++) {
      const body = mockRequest.mock.calls[i][2];
      expect(body).toMatchObject({ auditorIds: [7], page: i + 1, pageSize: VULNERABILITY_SEARCH_MAX_PAGE_SIZE });
    }
  });

  it('never sends the legacy unbounded page size, even if the caller passes one', async () => {
    mockRequest.mockResolvedValueOnce({ data: rows(1, 12), headers: { 'x-total-count': '12' } });

    await getAllVulnerabilitiesCall({ reports: ['Blend'], pageSize: -1, page: 9 });

    expect(mockRequest).toHaveBeenCalledTimes(1);
    expect(mockRequest.mock.calls[0][2]).toMatchObject({ reports: ['Blend'], page: 1, pageSize: VULNERABILITY_SEARCH_MAX_PAGE_SIZE });
  });

  it('stops after a single short page', async () => {
    mockRequest.mockResolvedValueOnce({ data: rows(1, 28), headers: { 'x-total-count': '28' } });

    const result = await getAllVulnerabilitiesCall({ reports: ['Blend'] });

    expect(result).toHaveLength(28);
    expect(mockRequest).toHaveBeenCalledTimes(1);
  });

  it('handles an exact multiple of the page size by reading one trailing empty page', async () => {
    mockRequest
      .mockResolvedValueOnce({ data: rows(1, 100), headers: { 'x-total-count': '200' } })
      .mockResolvedValueOnce({ data: rows(101, 100), headers: { 'x-total-count': '200' } })
      .mockResolvedValueOnce({ data: [], headers: { 'x-total-count': '200' } });

    const result = await getAllVulnerabilitiesCall({});

    expect(result).toHaveLength(200);
    expect(mockRequest).toHaveBeenCalledTimes(3);
  });

  it('returns an empty list when nothing matches', async () => {
    mockRequest.mockResolvedValueOnce({ data: [], headers: { 'x-total-count': '0' } });

    const result = await getAllVulnerabilitiesCall({ protocols: ['Nothing'] });

    expect(result).toEqual([]);
    expect(mockRequest).toHaveBeenCalledTimes(1);
  });

  it('does not depend on the X-Total-Count header', async () => {
    mockRequest
      .mockResolvedValueOnce({ data: rows(1, 100), headers: {} })
      .mockResolvedValueOnce({ data: rows(101, 5), headers: {} });

    const result = await getAllVulnerabilitiesCall({});

    expect(result).toHaveLength(105);
    expect(mockRequest).toHaveBeenCalledTimes(2);
  });
});
