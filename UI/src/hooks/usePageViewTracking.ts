import { useEffect, useRef, useState } from 'react';
import { PageViewEntityType, PageViewCount } from '../api/soroban-security-portal/models/analytics';
import { recordPageViewCall, getPageViewCountCall } from '../api/soroban-security-portal/soroban-security-portal-api';

// Records a human page view once on mount and returns the public counts.
// Recording is fire-and-forget; bots that don't run JS never trigger it.
export const usePageViewTracking = (entityType: PageViewEntityType, entityId: number | undefined): PageViewCount | null => {
  const [count, setCount] = useState<PageViewCount | null>(null);
  const recordedFor = useRef<number | null>(null);

  useEffect(() => {
    if (!entityId || entityId <= 0) return;
    if (recordedFor.current === entityId) return; // guard double-fire (e.g. StrictMode / re-render)
    recordedFor.current = entityId;

    const run = async () => {
      try {
        await recordPageViewCall(entityType, entityId);
      } catch {
        /* non-blocking */
      }
      try {
        const c = await getPageViewCountCall(entityType, entityId);
        // ignoreError swallows failures and resolves to undefined; keep state as null in that case.
        if (c) setCount(c);
      } catch {
        /* ignore */
      }
    };
    void run();
  }, [entityType, entityId]);

  return count;
};
