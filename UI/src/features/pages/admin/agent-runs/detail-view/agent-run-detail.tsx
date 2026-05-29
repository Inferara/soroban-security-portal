import React, { FC, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Accordion, AccordionDetails, AccordionSummary, Alert, Box, Button, Checkbox,
  Chip, FormControl, FormControlLabel, InputLabel, MenuItem, Paper, Select,
  TextField, Typography,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { MarkdownView } from '../../../../../components/MarkdownView';
import { useAgentRunDetail } from './hooks';
import { CurrentPageState } from '../../admin-main-window/current-page-slice';
import { showError } from '../../../../dialog-handler/dialog-handler';
import { ApproveAgentRun, AgentRunStatus } from '../../../../../api/soroban-security-portal/models/agent-run';

interface EditableFinding {
  include: boolean;
  title: string;
  description: string;
  severity: string;
  tags: string;
  category: number;
}

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

  // Editable review state
  const [reportTitle, setReportTitle] = useState('');
  const [protocolName, setProtocolName] = useState('');
  const [auditorName, setAuditorName] = useState('');
  const [reportDate, setReportDate] = useState('');
  const [articleMarkdown, setArticleMarkdown] = useState('');
  const [findings, setFindings] = useState<EditableFinding[]>([]);

  // Populate state when run loads
  useEffect(() => {
    if (run) {
      setReportTitle(run.reportTitle ?? '');
      setProtocolName(run.protocolName ?? '');
      setAuditorName(run.auditorName ?? '');
      setReportDate(run.reportDate ?? '');
      setArticleMarkdown(run.articleMarkdown ?? '');
      setFindings(
        run.findings.map((f) => ({
          include: true,
          title: f.title,
          description: f.description,
          severity: f.severity,
          tags: f.tags.join(', '),
          category: f.category,
        }))
      );
    }
  }, [run]);

  const back = () => navigate('/admin/agent-runs');

  const act = async (fn: () => Promise<boolean>, failMsg: string) => {
    const ok = await fn();
    if (ok) back(); else showError(failMsg);
  };

  const updateFinding = (index: number, patch: Partial<EditableFinding>) => {
    setFindings((prev) => prev.map((f, i) => i === index ? { ...f, ...patch } : f));
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

  const includedCount = findings.filter((f) => f.include).length;

  const handleApprove = async () => {
    const payload: ApproveAgentRun = {
      reportTitle,
      protocolName,
      auditorName,
      reportDate: reportDate || undefined,
      articleMarkdown,
      findings: findings
        .filter((f) => f.include)
        .map((f) => ({
          title: f.title,
          description: f.description,
          severity: f.severity,
          tags: f.tags.split(',').map((t) => t.trim()).filter(Boolean),
          category: f.category,
        })),
    };
    const ok = await approve(payload);
    if (ok) back(); else showError('Failed to approve');
  };

  return (
    <Paper elevation={6} sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
        <Typography variant="h4">Agent run #{run.id}</Typography>
        <Chip label={run.status} />
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Source: {run.sourceUrl || '—'} &middot; Model: {run.model || '—'}
      </Typography>

      {run.status === AgentRunStatus.Failed && run.error && (
        <Alert severity="error" sx={{ my: 2 }}>{run.error}</Alert>
      )}

      {/* Report metadata */}
      <Typography variant="h6" sx={{ mt: 2, mb: 1 }}>Report metadata</Typography>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mb: 2 }}>
        <TextField
          label="Report title"
          value={reportTitle}
          onChange={(e) => setReportTitle(e.target.value)}
          sx={{ flex: '1 1 300px' }}
        />
        <TextField
          label="Protocol / project"
          value={protocolName}
          onChange={(e) => setProtocolName(e.target.value)}
          sx={{ flex: '1 1 200px' }}
        />
        <TextField
          label="Auditor"
          value={auditorName}
          onChange={(e) => setAuditorName(e.target.value)}
          sx={{ flex: '1 1 200px' }}
        />
        <TextField
          label="Audit date"
          value={reportDate}
          onChange={(e) => setReportDate(e.target.value)}
          sx={{ flex: '1 1 160px' }}
        />
      </Box>

      {/* Article */}
      <Typography variant="h6" sx={{ mt: 2, mb: 1 }}>Article (Markdown)</Typography>
      <TextField
        multiline
        rows={10}
        fullWidth
        label="Article (Markdown)"
        value={articleMarkdown}
        onChange={(e) => setArticleMarkdown(e.target.value)}
        sx={{ mb: 1 }}
      />
      <MarkdownView content={articleMarkdown} emptyMessage="No article produced." background={{ p: 2 }} />

      {/* Findings */}
      <Typography variant="h6" sx={{ mt: 3, mb: 1 }}>
        Extracted vulnerabilities ({run.findings.length})
      </Typography>
      {run.findingsUnparseable && (
        <Alert severity="warning" sx={{ my: 1 }}>
          The agent&apos;s findings output could not be parsed &mdash; review the reasoning below.
        </Alert>
      )}
      {findings.map((f, i) => (
        <Paper key={i} variant="outlined" sx={{ p: 2, mb: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <FormControlLabel
              control={
                <Checkbox
                  checked={f.include}
                  onChange={(e) => updateFinding(i, { include: e.target.checked })}
                  slotProps={{ input: { 'aria-label': `Include finding ${i}` } as React.InputHTMLAttributes<HTMLInputElement> }}
                />
              }
              label="Include"
            />
            <TextField
              label="Title"
              value={f.title}
              onChange={(e) => updateFinding(i, { title: e.target.value })}
              size="small"
              sx={{ flex: '1 1 200px' }}
            />
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel>Severity</InputLabel>
              <Select
                label="Severity"
                value={f.severity}
                onChange={(e) => updateFinding(i, { severity: e.target.value })}
              >
                {['critical', 'high', 'medium', 'low', 'note'].map((s) => (
                  <MenuItem key={s} value={s}>{s}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 160 }}>
              <InputLabel>Category</InputLabel>
              <Select
                label="Category"
                value={f.category}
                onChange={(e) => updateFinding(i, { category: Number(e.target.value) })}
              >
                <MenuItem value={0}>Valid</MenuItem>
                <MenuItem value={1}>Valid (not fixed)</MenuItem>
                <MenuItem value={2}>Valid (partially fixed)</MenuItem>
                <MenuItem value={3}>Invalid</MenuItem>
                <MenuItem value={100}>N/A</MenuItem>
              </Select>
            </FormControl>
            <TextField
              label="Tags (comma-separated)"
              value={f.tags}
              onChange={(e) => updateFinding(i, { tags: e.target.value })}
              size="small"
              sx={{ flex: '1 1 160px' }}
            />
          </Box>
          <TextField
            label="Description"
            multiline
            rows={3}
            fullWidth
            value={f.description}
            onChange={(e) => updateFinding(i, { description: e.target.value })}
            size="small"
          />
        </Paper>
      ))}

      {/* Transcript */}
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

      {/* Actions */}
      <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end', mt: 3 }}>
        <Button variant="contained" onClick={back}>Back</Button>
        <Button variant="contained" onClick={() => act(rerun, 'Failed to re-run')}>Re-run</Button>
        <Button
          variant="contained"
          color="error"
          disabled={run.status !== AgentRunStatus.Succeeded && run.status !== AgentRunStatus.Failed}
          onClick={() => act(reject, 'Failed to reject')}
        >
          Reject
        </Button>
        <Button
          variant="contained"
          color="success"
          disabled={run.status !== AgentRunStatus.Succeeded || includedCount === 0}
          onClick={handleApprove}
        >
          Approve selected ({includedCount})
        </Button>
      </Box>
    </Paper>
  );
};
