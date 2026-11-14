import { useCallback, useEffect, useRef, useState } from 'react';
import { useDispatch } from 'react-redux';
import { setCurrentPage } from '../../admin-main-window/current-page-slice';
import {
  createServiceApiKeyCall,
  downloadApiUsageCsvCall,
  getAllApiKeysCall,
  getApiUsageStatisticsCall,
  revokeAnyApiKeyCall,
} from '../../../../../api/soroban-security-portal/soroban-security-portal-api';
import {
  ApiKey,
  ApiUsageStatistics,
  CreatedApiKey,
  CreateServiceApiKeyRequest,
} from '../../../../../api/soroban-security-portal/models/api-key';

/** enabled: load only for admins; the endpoints refuse everyone else. */
export const useApiUsage = (enabled: boolean) => {
  const dispatch = useDispatch();
  const [days, setDays] = useState(30);
  const [stats, setStats] = useState<ApiUsageStatistics | null>(null);
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);

  // Loads can overlap (period change, refresh after an action). Only the latest one may update
  // the page, so a slow earlier response cannot show one period under another period's selector.
  const requestIdRef = useRef(0);

  const load = useCallback(async () => {
    if (!enabled) return;
    const requestId = ++requestIdRef.current;
    try {
      setLoading(true);
      setError(null);
      const [loadedStats, loadedKeys] = await Promise.all([getApiUsageStatisticsCall(days), getAllApiKeysCall()]);
      if (requestIdRef.current !== requestId) return;
      setStats(loadedStats);
      setKeys(loadedKeys);
    } catch {
      if (requestIdRef.current !== requestId) return;
      setError('Failed to load API usage');
    } finally {
      if (requestIdRef.current === requestId) setLoading(false);
    }
  }, [days, enabled]);

  useEffect(() => {
    dispatch(setCurrentPage({ pageName: 'API usage', pageCode: 'api-usage', pageUrl: window.location.pathname, routePath: 'api-usage' }));
  }, [dispatch]);

  useEffect(() => {
    void load();
  }, [load]);

  const revokeKey = async (id: number) => {
    await revokeAnyApiKeyCall(id);
    await load();
  };

  const createServiceKey = async (request: CreateServiceApiKeyRequest): Promise<CreatedApiKey> => {
    const created = await createServiceApiKeyCall(request);
    await load();
    return created;
  };

  const downloadCsv = async () => {
    const blob = await downloadApiUsageCsvCall(days);
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `api-usage-last-${days}-days.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  return { days, setDays, stats, keys, loading, error, reload: load, revokeKey, createServiceKey, downloadCsv };
};
