export interface AgentFinding {
  title: string;
  description: string;
  severity: string;
  tags: string[];
  category: number;
}

export interface AgentRunListItem {
  id: number;
  status: string;
  sourceUrl: string;
  reportId?: number;
  model: string;
  error: string;
  tokensUsed?: number;
  durationMs?: number;
  createdBy: number;
  createdAt: string;
  startedAt?: string;
  finishedAt?: string;
  createdReportId?: number;
}

export interface AgentRun extends AgentRunListItem {
  promptVersion: string;
  articleMarkdown: string;
  findings: AgentFinding[];
  transcript: string;
  createdVulnerabilityIds?: number[];
  findingsUnparseable: boolean;
  reportTitle: string;
  protocolName: string;
  auditorName: string;
  reportDate?: string;
}

export interface ApproveAgentRun {
  reportTitle: string;
  protocolName: string;
  auditorName: string;
  reportDate?: string;
  articleMarkdown: string;
  findings: AgentFinding[];
}

export interface AgentRunListResult {
  items: AgentRunListItem[];
  total: number;
}

export interface EnqueueAgentRun {
  sourceUrl?: string;
  reportId?: number;
  model?: string;
}

export const AgentRunStatus = {
  Queued: 'queued',
  Processing: 'processing',
  Succeeded: 'succeeded',
  Failed: 'failed',
  Approved: 'approved',
  Rejected: 'rejected',
} as const;
