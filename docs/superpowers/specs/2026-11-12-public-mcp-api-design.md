# Public MCP server and REST API (issue #258)

## Why

Developers ask their AI agent instead of browsing a site. The portal's data
(findings, audit reports, protocols, auditors) should be reachable from Claude
Code, Cursor and similar clients, and from plain HTTP for partners. We also
need numbers for SCF reporting: who calls what, and how often.

## Goals

- An MCP endpoint and a documented read-only REST API, both backed by the same
  service code, so they can never drift apart.
- Access only for registered users, through API keys they create and revoke
  themselves. Admins can issue service keys with their own limits.
- Limits per key (per minute, per day) and one global cap, so a single caller
  or a flood cannot take the portal down or run up the embedding bill.
- Every call is logged. Admins see usage per day, per operation, per source and
  per key, and can export it as CSV.
- A connection guide and API reference at stable URLs.

## Non-goals

- Write operations of any kind.
- soroban-ret tools (issue #259). The tool runner here is built so #259 only
  adds tools.
- OAuth for MCP clients. API keys in the `Authorization` header are supported
  by every client we target; OAuth can be added later without breaking keys.

## Anti-goals

- An API key must never work on the existing portal API (`/api/v1/...`). A
  leaked key of an admin must not be an admin session.
- The public surface must never return hidden, deleted, rejected or
  not-yet-approved content, or internal fields (creator ids, raw PDFs).
- No promotional content in tool answers.

## Design

### Surface

| What | Where |
|---|---|
| MCP (Streamable HTTP, stateless) | `POST /api/mcp` |
| REST | `GET /api/public/v1/...` |
| OpenAPI | `/api/swagger/public-v1/swagger.json` |
| Key management (portal session only) | `/api/v1/api-keys` |
| Admin: all keys, service keys, usage statistics, CSV | `/api/v1/api-keys/all`, `/service`, `/usage/...` |

Both public paths live under `/api`, which the ingress already routes to the
API service, so no infrastructure change is needed.

Operations (same set on both transports):

| REST | MCP tool |
|---|---|
| `GET vulnerabilities` | `search_vulnerabilities` |
| `GET vulnerabilities/{id}` | `get_vulnerability` |
| `GET reports` | `search_reports` |
| `GET reports/{id}` | `get_report` (metadata + its findings) |
| `GET protocols`, `auditors`, `companies` | `list_protocols`, `list_auditors`, `list_companies` |

Search results are compact (no Markdown body); the full description comes from
the single-item call. Page size is capped at 100 by the same rule as the
portal's own search. Every item carries a stable id and its portal URL.

Text search uses the existing trigram + embedding ranking. If the embedding
provider is unavailable or slow (8 second budget), search degrades to text-only
instead of failing, with a lower relevance bar because the configured one is
tuned for text and vector scores together. After a failure the provider is
skipped for a minute. Query embeddings are cached in memory for an hour. The
result says which mode was used (`searchMode`).

### API keys

- Format `ssp_` + 40 random base62 characters (about 238 bits). Only the
  SHA-256 hash and a short display prefix are stored. The key is shown once.
- Up to 5 active keys per user. Revoking is immediate.
- A key stops working when its owner is disabled or deleted.
- Kinds: `Personal` (default limits) and `Service` (admin-issued, optional
  custom limits, reported as its own source).
- Accepted as `Authorization: Bearer ssp_...` or `X-API-Key: ssp_...`.
- A dedicated authentication scheme is selected only for `/api/mcp` and
  `/api/public/...`; everywhere else an `ssp_` token is simply an invalid JWT.

### Limits

Fixed windows per key: 60 calls/minute and 2,000 calls/day by default, plus a
global 600 calls/minute across all keys. All three are portal settings. A
service key can carry its own per-minute and per-day values.

Counters are kept in memory. The API runs as a single replica; on restart the
per-day counter is seeded from the usage log so a restart does not reset
quotas. If the API is ever scaled out, the counter store is one interface to
swap for Redis.

Over the limit: REST answers `429` with `Retry-After`; an MCP tool call returns
an error result that says which limit was hit and when to retry.

### Usage log

One row per call: key, user, source (`mcp`/`rest`), operation, short argument
summary, status (`ok`/`error`/`rate_limited`/`not_found`), duration, time.
Admin endpoints aggregate by day, operation, source and key, and export CSV.
`last_used_at` on the key is updated at most once a minute.

### UI

- Profile: an "API keys" section (create, copy once, revoke) with the
  connection snippet.
- Admin: an "API usage" page (cards, daily chart, per-tool and per-key tables,
  CSV export, service key issuing, revoke any key).
- Public `/developers` page: connection guide for Claude Code, Cursor and
  generic MCP clients, plus the REST reference link.

### Database

Two tables, `api_key` and `api_usage_log`, in one migration. `ProductVersion`
goes to 1.29 so the migration actually runs on deploy.

## Testing

Unit tests for key generation/hashing, the limiter, the auth handler, the
service's visibility rules and the controllers. Then a full local end-to-end
pass against a restored database: create a key in the UI, connect a real MCP
client, call every tool and REST endpoint, hit the limits, check the usage
page and the CSV.
