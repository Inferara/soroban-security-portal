import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAppDispatch } from '../../../../../../app/hooks';
import { setCurrentPage, CurrentPageState } from '../../../admin-main-window/current-page-slice';
import {
  getAgentRunByIdCall,
  approveAgentRunCall,
  rejectAgentRunCall,
  rerunAgentRunCall,
  enqueueAgentRunCall,
  getProtocolListDataCall,
  getAuditorListDataCall,
  getAllReportListDataCall,
} from '../../../../../../api/soroban-security-portal/soroban-security-portal-api';
import { AgentRun, ApproveAgentRun, EnqueueAgentRun, AgentRunStatus } from '../../../../../../api/soroban-security-portal/models/agent-run';
import { ProtocolItem } from '../../../../../../api/soroban-security-portal/models/protocol';
import { AuditorItem } from '../../../../../../api/soroban-security-portal/models/auditor';
import { Report } from '../../../../../../api/soroban-security-portal/models/report';

interface UseAgentRunDetailProps {
  currentPageState: CurrentPageState;
}

export const useAgentRunDetail = (props: UseAgentRunDetailProps) => {
  const { currentPageState } = props;
  const dispatch = useAppDispatch();
  const [searchParams] = useSearchParams();
  const runIdParam = searchParams.get('runId');
  const runId = runIdParam ? parseInt(runIdParam, 10) : undefined;
  const [run, setRun] = useState<AgentRun | null | undefined>(undefined);
  // Existing protocols/auditors power the review-screen Autocompletes so a moderator picks the
  // canonical entity by name (backend resolves protocol/auditor by name on approve) instead of
  // free-typing a near-duplicate or leaving it blank — which left vulnerabilities unlinked.
  const [protocolsList, setProtocolsList] = useState<ProtocolItem[]>([]);
  const [auditorsList, setAuditorsList] = useState<AuditorItem[]>([]);
  // Existing reports power the "attach to an existing report" picker, so a moderator can link the
  // findings to a report that's already in the portal (no duplicate) instead of creating a new one.
  const [reportsList, setReportsList] = useState<Report[]>([]);

  const load = useCallback(async (): Promise<void> => {
    if (runId) {
      setRun(await getAgentRunByIdCall(runId));
    } else {
      setRun(null);
    }
  }, [runId]);

  const approve = useCallback(async (payload: ApproveAgentRun): Promise<boolean> => {
    if (!runId) return false;
    await approveAgentRunCall(runId, payload);
    return true;
  }, [runId]);

  const reject = useCallback(async (): Promise<boolean> => {
    if (!runId) return false;
    await rejectAgentRunCall(runId);
    return true;
  }, [runId]);

  const rerun = useCallback(async (): Promise<boolean> => {
    if (!runId) return false;
    await rerunAgentRunCall(runId);
    return true;
  }, [runId]);

  const enqueue = useCallback(async (request: EnqueueAgentRun): Promise<boolean> => {
    await enqueueAgentRunCall(request);
    return true;
  }, []);

  useEffect(() => {
    dispatch(setCurrentPage(currentPageState));
    void load();
    void (async () => {
      try {
        const [protocols, auditors, reports] = await Promise.all([
          getProtocolListDataCall(),
          getAuditorListDataCall(),
          getAllReportListDataCall(),
        ]);
        setProtocolsList(protocols);
        setAuditorsList(auditors);
        setReportsList(reports);
      } catch {
        // Non-fatal: the Autocompletes just fall back to free-text entry.
      }
    })();
  }, [dispatch, currentPageState, load]);

  // Poll every 3 s while the run is being processed
  useEffect(() => {
    if (run?.status !== AgentRunStatus.Processing) return;
    const t = setInterval(() => { void load(); }, 3000);
    return () => clearInterval(t);
  }, [run?.status, load]);

  return { runId, run, approve, reject, rerun, enqueue, protocolsList, auditorsList, reportsList };
};
