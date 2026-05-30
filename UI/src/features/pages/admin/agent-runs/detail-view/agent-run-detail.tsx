import React, { FC, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Accordion, AccordionDetails, AccordionSummary, Alert, Box, Button, Checkbox,
  Chip, FormControl, FormControlLabel, InputLabel, Link, LinearProgress, MenuItem,
  Paper, Select, TextField, Typography,
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

const severityColor = (
  severity: string,
): 'error' | 'warning' | 'info' | 'default' => {
  switch (severity.toLowerCase()) {
    case 'critical': return 'error';
    case 'high': return 'warning';
    case 'medium': return 'info';
    default: return 'default';
  }
};

const categoryLabel = (category: number): string => {
  switch (category) {
    case 0: return 'Valid';
    case 1: return 'Valid (not fixed)';
    case 2: return 'Valid (partially fixed)';
    case 3: return 'Invalid';
    case 100: return 'N/A';
    default: return String(category);
  }
};

/** Slice an ISO datetime to date-only YYYY-MM-DD */
const toDateOnly = (iso: string): string => {
  if (!iso) return '';
  return iso.slice(0, 10);
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

  // Editable review state
  const [reportTitle, setReportTitle] = useState('');
  const [protocolName, setProtocolName] = useState('');
  const [auditorName, setAuditorName] = useState('');
  const [reportDate, setReportDate] = useState('');
  const [articleMarkdown, setArticleMarkdown] = useState('');
  const [findings, setFindings] = useState<EditableFinding[]>([]);
  const initializedRef = useRef(false);

  // Populate editable state ONCE when run first reaches a reviewable status
  const isReviewable = run?.status === AgentRunStatus.Succeeded
    || run?.status === AgentRunStatus.Approved
    || run?.status === AgentRunStatus.Rejected;

  useEffect(() => {
    if (run && isReviewable && !initializedRef.current) {
      initializedRef.current = true;
      setReportTitle(run.reportTitle ?? '');
      setProtocolName(run.protocolName ?? '');
      setAuditorName(run.auditorName ?? '');
      // Store only the date portion for the date input
      setReportDate(toDateOnly(run.reportDate ?? ''));
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
  }, [run, isReviewable]);

  // Reasoning accordion — controlled; auto-expand while processing;
  // default to OPEN for succeeded runs so transcript is visible
  const [reasoningOpen, setReasoningOpen] = useState(true);
  useEffect(() => {
    if (run?.status === AgentRunStatus.Processing) {
      setReasoningOpen(true);
    }
  }, [run?.status]);

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

  const isProcessingOrQueued = run.status === AgentRunStatus.Processing
    || run.status === AgentRunStatus.Queued;

  const handleApprove = async () => {
    const payload: ApproveAgentRun = {
      reportTitle,
      protocolName,
      auditorName,
      // Send date-only string; backend coerces to DateTime
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

  // Header section — source as clickable link, model as Chip
  const header = (
    <Box sx={{ mb: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
        <Typography variant="h4">Agent run #{run.id}</Typography>
        <Chip label={run.status} />
      </Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
        <Typography variant="body2" color="text.secondary">Source:</Typography>
        {run.sourceUrl ? (
          <Link href={run.sourceUrl} target="_blank" rel="noopener noreferrer" variant="body2">
            {run.sourceUrl}
          </Link>
        ) : (
          <Typography variant="body2" color="text.secondary">—</Typography>
        )}
        <Typography variant="body2" color="text.secondary" sx={{ mx: 0.5 }}>&middot;</Typography>
        <Typography variant="body2" color="text.secondary">Model:</Typography>
        <Chip label={run.model || '—'} size="small" variant="outlined" />
      </Box>
    </Box>
  );

  // Reasoning accordion — always starts open
  const reasoningAccordion = (
    <Paper variant="outlined" sx={{ mt: 3 }}>
      <Accordion
        expanded={reasoningOpen}
        onChange={(_, v) => setReasoningOpen(v)}
        disableGutters
        elevation={0}
        sx={{ background: 'transparent' }}
      >
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>Agent reasoning</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <MarkdownView content={run.transcript} emptyMessage="No reasoning captured yet." />
        </AccordionDetails>
      </Accordion>
    </Paper>
  );

  if (isProcessingOrQueued) {
    return (
      <Paper elevation={6} sx={{ p: 3 }}>
        {header}
        {run.status === AgentRunStatus.Processing && (
          <>
            <LinearProgress sx={{ mb: 1 }} />
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              The agent is working…
            </Typography>
          </>
        )}
        {reasoningAccordion}
        <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end', mt: 3 }}>
          <Button variant="contained" onClick={back}>Back</Button>
        </Box>
      </Paper>
    );
  }

  return (
    <Paper elevation={6} sx={{ p: 3 }}>
      {header}

      {run.status === AgentRunStatus.Failed && run.error && (
        <Alert severity="error" sx={{ my: 2 }}>{run.error}</Alert>
      )}

      {/* Report metadata */}
      <Paper variant="outlined" sx={{ p: 2, mt: 2, mb: 3 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1.5 }}>Report metadata</Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
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
            type="date"
            value={reportDate}
            onChange={(e) => setReportDate(e.target.value)}
            sx={{ flex: '1 1 160px' }}
            slotProps={{ inputLabel: { shrink: true } }}
          />
        </Box>
      </Paper>

      {/* Article */}
      <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1.5 }}>Article (Markdown)</Typography>
        <TextField
          multiline
          rows={10}
          fullWidth
          label="Article (Markdown)"
          value={articleMarkdown}
          onChange={(e) => setArticleMarkdown(e.target.value)}
          sx={{ mb: 2 }}
        />
        <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
          Preview
        </Typography>
        <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, overflow: 'hidden' }}>
          <MarkdownView content={articleMarkdown} emptyMessage="No article produced." background={{ p: 2 }} />
        </Box>
      </Paper>

      {/* Findings */}
      <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
          Extracted vulnerabilities ({run.findings.length})
        </Typography>
        {run.findingsUnparseable && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            The agent&apos;s findings output could not be parsed &mdash; review the reasoning below.
          </Alert>
        )}
        {findings.map((f, i) => (
          <Accordion key={i} disableGutters elevation={0} variant="outlined" sx={{ mb: 1 }}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Box
                sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', flex: 1, minWidth: 0 }}
                onClick={(e) => e.stopPropagation()}
              >
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={f.include}
                      onChange={(e) => updateFinding(i, { include: e.target.checked })}
                      onClick={(e) => e.stopPropagation()}
                      slotProps={{ input: { 'aria-label': `Include finding ${i}` } as React.InputHTMLAttributes<HTMLInputElement> }}
                    />
                  }
                  label=""
                  sx={{ m: 0 }}
                />
                <Typography
                  variant="body2"
                  sx={{ fontWeight: 600, flex: '1 1 120px', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                >
                  {f.title || '(untitled)'}
                </Typography>
                <Chip
                  label={f.severity}
                  color={severityColor(f.severity)}
                  size="small"
                  sx={{ textTransform: 'capitalize' }}
                />
                <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
                  {categoryLabel(f.category)}
                </Typography>
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mb: 2 }}>
                <TextField
                  label="Title"
                  fullWidth
                  value={f.title}
                  onChange={(e) => updateFinding(i, { title: e.target.value })}
                />
                <FormControl sx={{ flex: '1 1 140px' }}>
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
                <FormControl sx={{ flex: '1 1 200px' }}>
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
                  sx={{ flex: '1 1 200px' }}
                />
              </Box>
              <TextField
                label="Description"
                multiline
                rows={8}
                fullWidth
                value={f.description}
                onChange={(e) => updateFinding(i, { description: e.target.value })}
                sx={{ mb: 2 }}
              />
              <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
                Preview
              </Typography>
              <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, overflow: 'hidden' }}>
                <MarkdownView
                  content={f.description}
                  emptyMessage="Nothing to preview"
                  background={{ p: 2 }}
                />
              </Box>
            </AccordionDetails>
          </Accordion>
        ))}
      </Paper>

      {/* Reasoning transcript */}
      {reasoningAccordion}

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
