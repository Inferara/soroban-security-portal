import { describe, it, expect, vi } from 'vitest';

vi.mock('../../../../../environments/environment', () => ({
  environment: { apiUrl: 'https://portal.example', basePath: '' },
}));

import { claudeCodeSnippet, curlSnippet, mcpJsonSnippet, mcpUrl, publicApiSpecUrl, publicApiUrl } from '../connection-snippets';

describe('connection snippets', () => {
  it('points at the MCP endpoint and the public API of the configured portal', () => {
    expect(mcpUrl()).toBe('https://portal.example/api/mcp');
    expect(publicApiUrl()).toBe('https://portal.example/api/public/v1');
    expect(publicApiSpecUrl()).toBe('https://portal.example/api/swagger/public-v1/swagger.json');
  });

  it('builds a Claude Code command with the given key', () => {
    const snippet = claudeCodeSnippet('ssp_abc');

    expect(snippet).toContain('claude mcp add --transport http stellar-security-portal https://portal.example/api/mcp');
    expect(snippet).toContain('--header "Authorization: Bearer ssp_abc"');
  });

  it('uses a placeholder, never a real key, when none is given', () => {
    expect(claudeCodeSnippet()).toContain('Bearer YOUR_API_KEY');
    expect(curlSnippet()).toContain('Bearer YOUR_API_KEY');
  });

  it('builds valid JSON for other MCP clients', () => {
    const config = JSON.parse(mcpJsonSnippet('ssp_abc'));

    expect(config.mcpServers['stellar-security-portal']).toEqual({
      url: 'https://portal.example/api/mcp',
      headers: { Authorization: 'Bearer ssp_abc' },
    });
  });
});
