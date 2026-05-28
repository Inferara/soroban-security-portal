import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { setCurrentPage } from '../../admin-main-window/current-page-slice';
import { getAnalyticsStatisticsCall } from '../../../../../api/soroban-security-portal/soroban-security-portal-api';
import { AnalyticsStatistics } from '../../../../../api/soroban-security-portal/models/analytics';

export const useStatistics = () => {
  const dispatch = useDispatch();
  const [stats, setStats] = useState<AnalyticsStatistics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    dispatch(setCurrentPage({ pageName: 'Statistics', pageCode: 'statistics', pageUrl: window.location.pathname, routePath: 'statistics' }));
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        setStats(await getAnalyticsStatisticsCall());
      } catch {
        setError('Failed to load statistics');
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [dispatch]);

  return { stats, loading, error };
};
