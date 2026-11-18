import { FC } from 'react';
import { Box, Link, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { CodeBlock } from '../../../../components/CodeBlock';
import { environment } from '../../../../environments/environment';
import {
  claudeCodeSnippet,
  curlSnippet,
  mcpJsonSnippet,
  mcpUrl,
  publicApiDocsUrl,
  publicApiSpecUrl,
  publicApiUrl,
} from './connection-snippets';

const tools: { name: string; rest: string; description: string }[] = [
  { name: 'search_vulnerabilities', rest: 'GET /vulnerabilities', description: 'Search audit findings by text, severity, fix status, tag, protocol, auditor, company, report or date.' },
  { name: 'get_vulnerability', rest: 'GET /vulnerabilities/{id}', description: 'One finding with its full Markdown write-up.' },
  { name: 'search_reports', rest: 'GET /reports', description: 'Search audit reports by text, protocol, auditor, company or date.' },
  { name: 'get_report', rest: 'GET /reports/{id}', description: 'One report with its findings and a per-severity count. The report text is optional.' },
  { name: 'list_protocols', rest: 'GET /protocols', description: 'All protocols, with company and number of reports.' },
  { name: 'list_auditors', rest: 'GET /auditors', description: 'All audit firms, with number of reports.' },
  { name: 'list_companies', rest: 'GET /companies', description: 'All companies, with number of reports.' },
  { name: 'list_tags', rest: 'GET /tags', description: 'All tags used on findings, with number of findings.' },
  { name: 'ret_versions', rest: 'MCP only', description: 'The soroban-ret versions the decompiler can use.' },
  { name: 'ret_decompile_address', rest: 'MCP only', description: 'Recover Rust source from a deployed contract, by address (mainnet or testnet).' },
  { name: 'ret_decompile_wasm', rest: 'MCP only', description: 'Recover Rust source from a compiled contract (.wasm, base64, up to 512 KB).' },
];

const Section: FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <Box component="section" sx={{ mb: 5 }}>
    <Typography variant="h5" component="h2" sx={{ fontWeight: 600, mb: 2 }}>
      {title}
    </Typography>
    {children}
  </Box>
);

/**
 * Public connection guide for the MCP server and the REST API.
 * The URL of this page is linked from outside (for example from agent skills), so keep it stable.
 */
export const Developers: FC = () => {
  return (
    <Box sx={{ p: 3, minHeight: '80vh', width: { xs: '95%', md: '80%', lg: '60%' }, mx: 'auto' }}>
      <Typography variant="h4" component="h1" sx={{ fontWeight: 600, mb: 2 }}>
        API &amp; MCP for developers
      </Typography>
      <Typography sx={{ mb: 5 }}>
        Everything on the portal &mdash; audit findings, audit reports, protocols and auditors &mdash; is available to your
        AI agent through the Model Context Protocol (MCP), and to your own code through a REST API. Both are read-only
        and return the same data.
      </Typography>

      <Section title="1. Get an API key">
        <Typography>
          Sign in, open{' '}
          <Link component={RouterLink} to={`${environment.basePath}/profile`}>
            your profile
          </Link>
          , go to the <strong>API keys</strong> tab and create a key. The key is shown once, so copy it right away. You
          can revoke a key at any time on the same tab.
        </Typography>
      </Section>

      <Section title="2. Connect your agent (MCP)">
        <Typography sx={{ mb: 1 }}>
          MCP endpoint (Streamable HTTP): <code>{mcpUrl()}</code>
        </Typography>
        <Typography variant="subtitle1" sx={{ fontWeight: 600, mt: 3, mb: 1 }}>
          Claude Code
        </Typography>
        <CodeBlock className="language-bash">{claudeCodeSnippet()}</CodeBlock>
        <Typography variant="subtitle1" sx={{ fontWeight: 600, mt: 3, mb: 1 }}>
          Cursor, VS Code and other clients
        </Typography>
        <Typography sx={{ mb: 1 }}>
          Add the server to the client&apos;s MCP configuration (for Cursor that is <code>.cursor/mcp.json</code>):
        </Typography>
        <CodeBlock className="language-json">{mcpJsonSnippet()}</CodeBlock>
        <Typography sx={{ mt: 2 }}>
          Then ask your agent something like: <em>&quot;Search the Stellar Security Portal for findings about missing
          authorization checks in Soroban contracts and summarise the common root causes.&quot;</em>
        </Typography>
      </Section>

      <Section title="3. Tools and endpoints">
        <TableContainer component={Paper} variant="outlined">
          <Table size="small" aria-label="Tools and endpoints">
            <TableHead>
              <TableRow>
                <TableCell>MCP tool</TableCell>
                <TableCell>REST endpoint</TableCell>
                <TableCell>What it does</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {tools.map((tool) => (
                <TableRow key={tool.name}>
                  <TableCell sx={{ fontFamily: 'monospace', whiteSpace: 'nowrap' }}>{tool.name}</TableCell>
                  <TableCell sx={{ fontFamily: 'monospace', whiteSpace: 'nowrap' }}>{tool.rest}</TableCell>
                  <TableCell>{tool.description}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
        <Typography sx={{ mt: 2 }}>
          The decompiler tools run{' '}
          <Link href="https://github.com/Inferara/soroban-ret" target="_blank" rel="noopener">
            soroban-ret
          </Link>
          , the same engine as the <Link component={RouterLink} to={`${environment.basePath}/dev-tools`}>Dev Tools</Link> page. They return
          an approximation of the original Rust (function signatures, types and recovered bodies), which is useful for understanding
          or reviewing a contract you do not have the source for. Large contracts can take up to a minute.
        </Typography>
        <Typography sx={{ mt: 2 }}>
          Filters that take a protocol, auditor or company accept either its name or its id. The tag filter takes a tag
          name and ignores case. Search results are compact; ask for a single finding to get the full description. Every
          item carries a <code>url</code> to its page on the portal.
        </Typography>
        <Typography sx={{ mt: 2 }}>
          Tool names, endpoint paths, parameter names and response fields are stable: new ones are added, existing ones
          are not renamed or removed. Agent skills and other tools can rely on them.
        </Typography>
      </Section>

      <Section title="4. REST API">
        <Typography sx={{ mb: 1 }}>
          Base URL: <code>{publicApiUrl()}</code>. Send the key as <code>Authorization: Bearer &lt;key&gt;</code> (or{' '}
          <code>X-API-Key: &lt;key&gt;</code>).
        </Typography>
        <CodeBlock className="language-bash">{curlSnippet()}</CodeBlock>
        <Typography sx={{ mt: 2 }}>
          Full reference:{' '}
          <Link href={publicApiDocsUrl()} target="_blank" rel="noopener">
            interactive API docs
          </Link>{' '}
          and the{' '}
          <Link href={publicApiSpecUrl()} target="_blank" rel="noopener">
            OpenAPI spec
          </Link>
          .
        </Typography>
      </Section>

      <Section title="5. Limits and errors">
        <Typography sx={{ mb: 1 }}>
          The limits are per user: all your keys share one allowance, with a per-minute and a per-day call limit (the
          current values are shown on the API keys tab). Decompiler calls also have to fit a stricter allowance of their own,
          because they are CPU heavy: start with a few calls a minute and reuse results. When a limit is reached:
        </Typography>
        <Box component="ul" sx={{ mt: 0 }}>
          <li>
            <Typography>
              the REST API answers <code>429</code> with a <code>Retry-After</code> header (seconds);
            </Typography>
          </li>
          <li>
            <Typography>an MCP tool returns an error that says which limit was hit and when to retry.</Typography>
          </li>
        </Box>
        <Typography>
          Other REST errors use the usual status codes (<code>400</code> bad input, <code>401</code> missing or revoked
          key, <code>404</code> not found) with a JSON body: <code>{'{ "error": "...", "message": "..." }'}</code>.
        </Typography>
      </Section>

      <Section title="6. Data use and attribution">
        <Typography>
          The Stellar Security Portal is maintained by Inferara. Findings and reports come from the named audit
          firms&apos; published reports. When you quote them, cite the portal link and the auditor. The data is provided
          as is and is not a security assessment of any code.
        </Typography>
      </Section>
    </Box>
  );
};
