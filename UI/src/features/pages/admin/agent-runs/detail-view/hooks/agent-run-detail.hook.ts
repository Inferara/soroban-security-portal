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
} from '../../../../../../api/soroban-security-portal/soroban-security-portal-api';
import { AgentRun, EnqueueAgentRun } from '../../../../../../api/soroban-security-portal/models/agent-run';

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

  const load = useCallback(async (): Promise<void> => {
    if (runId) {
      setRun(await getAgentRunByIdCall(runId));
    } else {
      setRun(null);
    }
  }, [runId]);

  const approve = useCallback(async (): Promise<boolean> => {
    if (!runId) return false;
    await approveAgentRunCall(runId);
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
  }, [dispatch, currentPageState, load]);

  return { runId, run, approve, reject, rerun, enqueue };
};
