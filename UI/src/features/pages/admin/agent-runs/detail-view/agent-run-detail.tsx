import { FC, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Accordion, AccordionDetails, AccordionSummary, Alert, Box, Button, Chip, Paper,
  Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { MarkdownView } from '../../../../../components/MarkdownView';
import { useAgentRunDetail } from './hooks';
import { CurrentPageState } from '../../admin-main-window/current-page-slice';
import { showError } from '../../../../dialog-handler/dialog-handler';
import { AgentRunStatus } from '../../../../../api/soroban-security-portal/models/agent-run';

const categoryLabel = (c: number): string => {
  switch (c) {
    case 0: return 'Valid';
    case 1: return 'Valid (not fixed)';
    case 2: return 'Valid (partially fixed)';
    case 3: return 'Invalid';
    default: return 'N/A';
  }
};

export const AgentRunDetail: FC = () => {
  const navigate = useNavigate();
  const currentPageState: CurrentPageState = useMemo(() => ({
    pageName: 'Agent Run',
    pageCode: 'agentRunDetail',
    pageUrl: window.location.pathname,
    routePath: 'admin/agent-runs/detail',
  }), []);
  const { runId, run, approve, reject, rerun, enqueue } = useAgentRunDetail({ currentPageState });
  const [sourceUrl, setSourceUrl] = useState('');

  const back = () => navigate('/admin/agent-runs');
  const act = async (fn: () => Promise<boolean>, failMsg: string) => {
    const ok = await fn();
    if (ok) back(); else showError(failMsg);
  };

  if (!runId) {
    return (
      <Paper elevation={6} sx={{ p: 3 }}>
        <Typography variant="h4" gutterBottom>New agent run</Typography>
        <TextField fullWidth label="Report source URL" value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} sx={{ mb: 2 }} />
        <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
          <Button variant="contained" onClick={back}>Cancel</Button>
          <Button variant="contained" color="success" disabled={!sourceUrl.trim()}
            onClick={() => act(() => enqueue({ sourceUrl }), 'Failed to enqueue run')}>
            Enqueue
          </Button>
        </Box>
      </Paper>
    );
  }

  if (run === undefined) {
    return <Box sx={{ p: 4 }}><Typography variant="h6">Loading run...</Typography></Box>;
  }
  if (run === null) {
    return <Box sx={{ p: 4 }}><Typography variant="h6">Run not found.</Typography></Box>;
  }

  return (
    <Paper elevation={6} sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
        <Typography variant="h4">Agent run #{run.id}</Typography>
        <Chip label={run.status} />
      </Box>
      <Typography variant="body2" color="text.secondary">Source: {run.sourceUrl || '—'} &middot; Model: {run.model || '—'}</Typography>

      {run.status === AgentRunStatus.Failed && run.error && (
        <Alert severity="error" sx={{ my: 2 }}>{run.error}</Alert>
      )}

      <Typography variant="h6" sx={{ mt: 3 }}>Article</Typography>
      <MarkdownView content={run.articleMarkdown} emptyMessage="No article produced." background={{ p: 2 }} />

      <Typography variant="h6" sx={{ mt: 3 }}>Extracted vulnerabilities ({run.findings.length})</Typography>
      {run.findingsUnparseable && (
        <Alert severity="warning" sx={{ my: 1 }}>The agent&apos;s findings output could not be parsed &mdash; review the reasoning below.</Alert>
      )}
      {run.findings.length > 0 && (
        <Table size="small">
          <TableHead><TableRow><TableCell>Title</TableCell><TableCell>Severity</TableCell><TableCell>Category</TableCell><TableCell>Tags</TableCell></TableRow></TableHead>
          <TableBody>
            {run.findings.map((f, i) => (
              <TableRow key={i}><TableCell>{f.title}</TableCell><TableCell>{f.severity}</TableCell><TableCell>{categoryLabel(f.category)}</TableCell><TableCell>{f.tags.join(', ')}</TableCell></TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Accordion sx={{ mt: 3 }}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography>Agent reasoning</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Box component="pre" sx={{ whiteSpace: 'pre-wrap', fontFamily: 'monospace', fontSize: 13, m: 0 }}>
            {run.transcript || 'No transcript captured.'}
          </Box>
        </AccordionDetails>
      </Accordion>

      <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end', mt: 3 }}>
        <Button variant="contained" onClick={back}>Back</Button>
        <Button variant="contained" onClick={() => act(rerun, 'Failed to re-run')}>Re-run</Button>
        <Button variant="contained" color="error"
          disabled={run.status !== AgentRunStatus.Succeeded && run.status !== AgentRunStatus.Failed}
          onClick={() => act(reject, 'Failed to reject')}>Reject</Button>
        <Button variant="contained" color="success"
          disabled={run.status !== AgentRunStatus.Succeeded}
          onClick={() => act(approve, 'Failed to approve')}>Approve</Button>
      </Box>
    </Paper>
  );
};
