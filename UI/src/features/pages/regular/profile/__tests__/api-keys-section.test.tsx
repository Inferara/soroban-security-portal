import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { ApiKeysSection } from '../api-keys-section';
import * as api from '../../../../../api/soroban-security-portal/soroban-security-portal-api';
import { ApiKey, ApiKeyKind } from '../../../../../api/soroban-security-portal/models/api-key';

vi.mock('../../../../../api/soroban-security-portal/soroban-security-portal-api', () => ({
  getApiKeysCall: vi.fn(),
  getApiLimitsCall: vi.fn(),
  createApiKeyCall: vi.fn(),
  revokeApiKeyCall: vi.fn(),
}));

vi.mock('../../../../../components/CodeBlock', () => ({
  CodeBlock: ({ children }: { children: string }) => <pre data-testid="code-block">{children}</pre>,
}));

const FULL_KEY = 'ssp_0123456789abcdefghijABCDEFGHIJ0123456789';

const key = (overrides: Partial<ApiKey> = {}): ApiKey => ({
  id: 1,
  name: 'Laptop',
  keyPrefix: 'ssp_AAAAAAAA',
  kind: ApiKeyKind.Personal,
  rateLimitPerMinute: null,
  rateLimitPerDay: null,
  createdAt: '2026-11-01T10:00:00Z',
  lastUsedAt: null,
  revokedAt: null,
  ...overrides,
});

const renderSection = () =>
  render(
    <MemoryRouter>
      <ApiKeysSection />
    </MemoryRouter>,
  );

describe('ApiKeysSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.getApiLimitsCall).mockResolvedValue({ rateLimitPerMinute: 60, rateLimitPerDay: 2000, maxKeysPerUser: 5 });
    vi.mocked(api.getApiKeysCall).mockResolvedValue([]);
  });

  it('shows the limits and an empty state when the user has no keys', async () => {
    renderSection();

    expect(await screen.findByText(/You have no API keys yet/)).toBeInTheDocument();
    expect(screen.getByText(/60 calls per minute, 2,000 calls per day/)).toBeInTheDocument();
  });

  it('lists keys by prefix only and marks revoked ones', async () => {
    vi.mocked(api.getApiKeysCall).mockResolvedValue([
      key(),
      key({ id: 2, name: 'Old CI', keyPrefix: 'ssp_BBBBBBBB', revokedAt: '2026-11-02T10:00:00Z' }),
    ]);
    renderSection();

    const activeRow = (await screen.findByText('Laptop')).closest('tr')!;
    expect(within(activeRow).getByText('ssp_AAAAAAAA…')).toBeInTheDocument();
    expect(within(activeRow).getByText('Active')).toBeInTheDocument();
    expect(within(activeRow).getByText('Never')).toBeInTheDocument();

    const revokedRow = screen.getByText('Old CI').closest('tr')!;
    expect(within(revokedRow).getByText('Revoked')).toBeInTheDocument();
    // A revoked key cannot be revoked again.
    expect(within(revokedRow).queryByRole('button')).not.toBeInTheDocument();
  });

  it('creates a key, shows it once with a ready-to-run command, and hides it after closing', async () => {
    vi.mocked(api.createApiKeyCall).mockResolvedValue({ ...key({ id: 3, name: 'Claude Code' }), key: FULL_KEY });
    renderSection();
    await screen.findByText(/You have no API keys yet/);

    fireEvent.click(screen.getByRole('button', { name: 'Create API key' }));
    const createButton = screen.getByRole('button', { name: 'Create' });
    expect(createButton).toBeDisabled(); // a name is required

    fireEvent.change(screen.getByLabelText('Key name'), { target: { value: '  Claude Code  ' } });
    fireEvent.click(createButton);

    await waitFor(() => expect(api.createApiKeyCall).toHaveBeenCalledWith('Claude Code'));
    expect(await screen.findByText('Your new API key')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'New API key' })).toHaveValue(FULL_KEY);
    expect(screen.getByTestId('code-block').textContent).toContain(`Authorization: Bearer ${FULL_KEY}`);
    expect(screen.getByText(/cannot be shown again/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Done' }));

    await waitFor(() => expect(screen.queryByText('Your new API key')).not.toBeInTheDocument());
    expect(screen.queryByDisplayValue(FULL_KEY)).not.toBeInTheDocument();
    expect(api.getApiKeysCall).toHaveBeenCalledTimes(2); // list refreshed after creating
  });

  it('keeps the form open when creating fails, so the name is not lost', async () => {
    vi.mocked(api.createApiKeyCall).mockRejectedValue(new Error('API call failed'));
    renderSection();
    await screen.findByText(/You have no API keys yet/);

    fireEvent.click(screen.getByRole('button', { name: 'Create API key' }));
    fireEvent.change(screen.getByLabelText('Key name'), { target: { value: 'CI' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));

    await waitFor(() => expect(api.createApiKeyCall).toHaveBeenCalled());
    expect(screen.getByLabelText('Key name')).toHaveValue('CI');
    expect(screen.queryByText('Your new API key')).not.toBeInTheDocument();
  });

  it('asks before revoking and revokes only after confirmation', async () => {
    vi.mocked(api.getApiKeysCall).mockResolvedValue([key()]);
    vi.mocked(api.revokeApiKeyCall).mockResolvedValue();
    renderSection();

    fireEvent.click(await screen.findByRole('button', { name: 'Revoke key Laptop' }));
    expect(screen.getByText(/stops working immediately/)).toBeInTheDocument();
    expect(api.revokeApiKeyCall).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(api.revokeApiKeyCall).not.toHaveBeenCalled();

    // The dialog closes with a transition; the page is reachable again once it is gone.
    fireEvent.click(await screen.findByRole('button', { name: 'Revoke key Laptop' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Revoke' }));

    await waitFor(() => expect(api.revokeApiKeyCall).toHaveBeenCalledWith(1));
    await waitFor(() => expect(api.getApiKeysCall).toHaveBeenCalledTimes(2));
  });

  it('disables creating at the key limit, counting only active keys', async () => {
    const active = [1, 2, 3, 4, 5].map((id) => key({ id, name: `Key ${id}` }));
    vi.mocked(api.getApiKeysCall).mockResolvedValue([...active, key({ id: 6, name: 'Gone', revokedAt: '2026-11-02T10:00:00Z' })]);
    renderSection();

    await screen.findByText('Key 1');
    expect(screen.getByRole('button', { name: 'Create API key' })).toBeDisabled();
  });

  it('offers a retry when the keys cannot be loaded', async () => {
    vi.mocked(api.getApiKeysCall).mockRejectedValueOnce(new Error('network'));
    renderSection();

    expect(await screen.findByText('Could not load your API keys.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create API key' })).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

    expect(await screen.findByText(/You have no API keys yet/)).toBeInTheDocument();
  });
});
