import { useCallback, useEffect, useState } from 'react';
import { useAppDispatch } from '../../../../../../app/hooks';
import { setCurrentPage, CurrentPageState } from '../../../admin-main-window/current-page-slice';
import {
  getAgentRunsCall,
  approveAgentRunCall,
  rejectAgentRunCall,
  rerunAgentRunCall,
} from '../../../../../../api/soroban-security-portal/soroban-security-portal-api';
import { AgentRunListItem } from '../../../../../../api/soroban-security-portal/models/agent-run';

interface UseListAgentRunsProps {
  currentPageState: CurrentPageState;
}

export const useListAgentRuns = (props: UseListAgentRunsProps) => {
  const { currentPageState } = props;
  const dispatch = useAppDispatch();
  const [agentRuns, setAgentRuns] = useState<AgentRunListItem[]>([]);

  const refresh = useCallback(async (): Promise<void> => {
    const result = await getAgentRunsCall();
    setAgentRuns(result.items);
  }, []);

  const approve = useCallback(async (id: number): Promise<void> => {
    await approveAgentRunCall(id);
    await refresh();
  }, [refresh]);

  const reject = useCallback(async (id: number): Promise<void> => {
    await rejectAgentRunCall(id);
    await refresh();
  }, [refresh]);

  const rerun = useCallback(async (id: number): Promise<void> => {
    await rerunAgentRunCall(id);
    await refresh();
  }, [refresh]);

  useEffect(() => {
    dispatch(setCurrentPage(currentPageState));
    void refresh();
  }, [dispatch, currentPageState, refresh]);

  return { agentRuns, approve, reject, rerun, refresh };
};
