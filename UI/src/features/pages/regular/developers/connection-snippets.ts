import { environment } from '../../../../environments/environment';

/** Shown where the user has not created (or cannot see) a key. */
export const API_KEY_PLACEHOLDER = 'YOUR_API_KEY';

export const mcpUrl = (): string => `${environment.apiUrl}/api/mcp`;
export const publicApiUrl = (): string => `${environment.apiUrl}/api/public/v1`;
export const publicApiDocsUrl = (): string => `${environment.apiUrl}/api/swagger/index.html`;
export const publicApiSpecUrl = (): string => `${environment.apiUrl}/api/swagger/public-v1/swagger.json`;

export const claudeCodeSnippet = (apiKey: string = API_KEY_PLACEHOLDER): string =>
  `claude mcp add --transport http stellar-security-portal ${mcpUrl()} \\\n  --header "Authorization: Bearer ${apiKey}"`;

/** Cursor, VS Code, Windsurf and most other clients read this JSON shape. */
export const mcpJsonSnippet = (apiKey: string = API_KEY_PLACEHOLDER): string =>
  JSON.stringify(
    {
      mcpServers: {
        'stellar-security-portal': {
          url: mcpUrl(),
          headers: { Authorization: `Bearer ${apiKey}` },
        },
      },
    },
    null,
    2,
  );

export const curlSnippet = (apiKey: string = API_KEY_PLACEHOLDER): string =>
  `curl "${publicApiUrl()}/vulnerabilities?query=missing%20authorization&severity=high" \\\n  -H "Authorization: Bearer ${apiKey}"`;
