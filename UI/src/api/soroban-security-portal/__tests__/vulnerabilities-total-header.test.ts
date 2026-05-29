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

import { getVulnerabilitiesWithTotalCall } from '../soroban-security-portal-api';

beforeEach(() => {
  mockRequest.mockReset();
});

describe('getVulnerabilitiesWithTotalCall', () => {
  it('returns items and total parsed from X-Total-Count header', async () => {
    mockRequest.mockResolvedValue({
      data: [{ id: 1 }, { id: 2 }],
      headers: { 'x-total-count': '57' },
    });
    const res = await getVulnerabilitiesWithTotalCall({ page: 1, pageSize: 10 } as any);
    expect(res.items).toHaveLength(2);
    expect(res.total).toBe(57);
  });

  it('falls back to items.length when the X-Total-Count header is absent', async () => {
    mockRequest.mockResolvedValue({
      data: [{ id: 1 }, { id: 2 }, { id: 3 }],
      headers: {},
    });
    const res = await getVulnerabilitiesWithTotalCall({ page: 1, pageSize: 10 } as any);
    expect(res.items).toHaveLength(3);
    expect(res.total).toBe(3);
  });

  it('guards a non-numeric X-Total-Count header to 0', async () => {
    mockRequest.mockResolvedValue({
      data: [{ id: 1 }],
      headers: { 'x-total-count': 'abc' },
    });
    const res = await getVulnerabilitiesWithTotalCall({ page: 1, pageSize: 10 } as any);
    expect(res.total).toBe(0);
  });
});
