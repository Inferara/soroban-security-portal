import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useVulnerabilityAdd } from '../vulnerabilities-add.hook';
import * as api from '../../../../../../api/soroban-security-portal/soroban-security-portal-api';
import { Vulnerability } from '../../../../../../api/soroban-security-portal/models/vulnerability';

const mockDispatch = vi.fn();

vi.mock('../../../../../../app/hooks', () => ({
  useAppDispatch: () => mockDispatch,
}));

vi.mock('../../../../../../api/soroban-security-portal/soroban-security-portal-api', () => ({
  getSeveritiesCall: vi.fn(),
  getTagsCall: vi.fn(),
  getProtocolListDataCall: vi.fn(),
  getSourceCall: vi.fn(),
  addVulnerabilityCall: vi.fn(),
  getAuditorListDataCall: vi.fn(),
  getCompanyListDataCall: vi.fn(),
}));

describe('useVulnerabilityAdd', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.getSeveritiesCall).mockResolvedValue([]);
    vi.mocked(api.getTagsCall).mockResolvedValue([]);
    vi.mocked(api.getProtocolListDataCall).mockResolvedValue([]);
    vi.mocked(api.getSourceCall).mockResolvedValue([]);
    vi.mocked(api.getAuditorListDataCall).mockResolvedValue([]);
    vi.mocked(api.getCompanyListDataCall).mockResolvedValue([]);
  });

  it('submits vulnerability without emitting debug console.log output', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.mocked(api.addVulnerabilityCall).mockResolvedValue({ id: 1 } as never);

    const { result } = renderHook(() => useVulnerabilityAdd());
    await waitFor(() => {
      expect(api.getSeveritiesCall).toHaveBeenCalledTimes(1);
    });

    await act(async () => {
      await result.current.addVulnerability({ title: 'Test finding' } as Vulnerability);
    });

    expect(api.addVulnerabilityCall).toHaveBeenCalledTimes(1);
    expect(logSpy).not.toHaveBeenCalled();
    logSpy.mockRestore();
  });

  it('logs console.error and rethrows when addVulnerabilityCall fails', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(api.addVulnerabilityCall).mockRejectedValue(new Error('Upload failed'));

    const { result } = renderHook(() => useVulnerabilityAdd());
    await waitFor(() => {
      expect(api.getSeveritiesCall).toHaveBeenCalledTimes(1);
    });

    await expect(
      act(async () => {
        await result.current.addVulnerability({ title: 'Test finding' } as Vulnerability);
      })
    ).rejects.toThrow('Upload failed');

    expect(errSpy).toHaveBeenCalledWith('Error adding vulnerability:', expect.any(Error));
    errSpy.mockRestore();
  });
});
