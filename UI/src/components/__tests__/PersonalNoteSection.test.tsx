import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PersonalNoteSection } from '../PersonalNoteSection';
import * as api from '../../api/soroban-security-portal/soroban-security-portal-api';

const mockUseAppAuth = vi.fn();

vi.mock('../../features/authentication/useAppAuth', () => ({
  useAppAuth: () => mockUseAppAuth(),
}));

vi.mock('../../contexts/ThemeContext', () => ({
  useTheme: () => ({
    themeMode: 'light',
    theme: { palette: { grey: { 400: '#bdbdbd' } } },
  }),
}));

vi.mock('../MarkdownView', () => ({
  MarkdownView: ({ content }: { content: string }) => (
    <div data-testid="markdown-view">{content}</div>
  ),
}));

vi.mock('../../features/dialog-handler/dialog-handler', () => ({
  showSuccess: vi.fn(),
  showError: vi.fn(),
}));

describe('PersonalNoteSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not render or fetch notes when user is unauthenticated', () => {
    mockUseAppAuth.mockReturnValue({ isAuthenticated: false });
    const getNoteSpy = vi.spyOn(api, 'getPersonalNoteByVulnerabilityCall');

    const { container } = render(<PersonalNoteSection vulnerabilityId={10} />);

    expect(container.firstChild).toBeNull();
    expect(getNoteSpy).not.toHaveBeenCalled();
  });

  it('allows an authenticated user to add and save a personal note', async () => {
    mockUseAppAuth.mockReturnValue({ isAuthenticated: true });
    vi.spyOn(api, 'getPersonalNoteByVulnerabilityCall').mockResolvedValue(null);
    const saveSpy = vi.spyOn(api, 'savePersonalNoteCall').mockResolvedValue({
      id: 1,
      vulnerabilityId: 10,
      content: 'My private note on reentrancy',
      createdAt: '2026-06-01T00:00:00Z',
      updatedAt: '2026-06-01T00:00:00Z',
      title: 'Reentrancy',
      description: 'Desc',
      severity: 'High',
    });

    render(<PersonalNoteSection vulnerabilityId={10} />);

    const addButton = await screen.findByRole('button', { name: /add personal note/i });
    fireEvent.click(addButton);

    const input = screen.getByLabelText('Personal note content');
    fireEvent.change(input, { target: { value: '  My private note on reentrancy  ' } });

    const saveButton = screen.getByRole('button', { name: /save note/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(saveSpy).toHaveBeenCalledWith(10, 'My private note on reentrancy');
    });

    expect(await screen.findByTestId('markdown-view')).toHaveTextContent(
      'My private note on reentrancy'
    );
  });

  it('renders existing personal note and supports editing and deleting', async () => {
    mockUseAppAuth.mockReturnValue({ isAuthenticated: true });
    vi.spyOn(api, 'getPersonalNoteByVulnerabilityCall').mockResolvedValue({
      id: 4,
      vulnerabilityId: 22,
      content: 'Existing secret note',
      createdAt: '2026-06-01T00:00:00Z',
      updatedAt: '2026-06-01T00:00:00Z',
      title: 'Overflow',
      description: 'Desc',
      severity: 'Critical',
    });
    const deleteSpy = vi
      .spyOn(api, 'deletePersonalNoteByVulnerabilityCall')
      .mockResolvedValue();

    render(<PersonalNoteSection vulnerabilityId={22} compact />);

    expect(await screen.findByTestId('markdown-view')).toHaveTextContent(
      'Existing secret note'
    );
    expect(screen.getByText('Visible only to you')).toBeInTheDocument();

    const deleteButton = screen.getByRole('button', { name: /delete personal note/i });
    fireEvent.click(deleteButton);

    await waitFor(() => {
      expect(deleteSpy).toHaveBeenCalledWith(22);
    });

    expect(
      await screen.findByRole('button', { name: /add personal note/i })
    ).toBeInTheDocument();
  });

  it('ignores stale load and save responses when vulnerabilityId changes mid-flight', async () => {
    mockUseAppAuth.mockReturnValue({ isAuthenticated: true });

    let resolveVuln10Load!: (value: api.PersonalNoteItem | null) => void;
    let resolveVuln10Save!: (value: api.PersonalNoteItem | null) => void;

    vi.spyOn(api, 'getPersonalNoteByVulnerabilityCall').mockImplementation((vulnId: number) => {
      if (vulnId === 10) {
        return new Promise((resolve) => {
          resolveVuln10Load = resolve;
        });
      }
      return Promise.resolve({
        id: 2,
        vulnerabilityId: 20,
        content: 'Vuln 20 fresh note',
        createdAt: '2026-06-01T00:00:00Z',
        updatedAt: '2026-06-01T00:00:00Z',
        title: 'Vuln 20',
        description: 'Desc 20',
        severity: 'Medium',
      });
    });

    vi.spyOn(api, 'savePersonalNoteCall').mockImplementation(() => {
      return new Promise((resolve) => {
        resolveVuln10Save = resolve;
      });
    });

    const { rerender } = render(<PersonalNoteSection vulnerabilityId={10} />);

    // Resolve initial load for vulnerability 10 as empty, start editing and trigger an in-flight save
    resolveVuln10Load(null);
    const addButton = await screen.findByRole('button', { name: /add personal note/i });
    fireEvent.click(addButton);

    const input = screen.getByLabelText('Personal note content');
    fireEvent.change(input, { target: { value: 'Stale vuln 10 save' } });
    fireEvent.click(screen.getByRole('button', { name: /save note/i }));

    // Switch to vulnerability 20 before vulnerability 10's save finishes
    rerender(<PersonalNoteSection vulnerabilityId={20} />);

    expect(await screen.findByTestId('markdown-view')).toHaveTextContent('Vuln 20 fresh note');

    // Now resolve the stale save from vulnerability 10 — it must NOT overwrite vulnerability 20's note
    resolveVuln10Save({
      id: 1,
      vulnerabilityId: 10,
      content: 'Stale vuln 10 save',
      createdAt: '2026-06-01T00:00:00Z',
      updatedAt: '2026-06-01T00:00:00Z',
      title: 'Vuln 10',
      description: 'Desc 10',
      severity: 'High',
    });

    await waitFor(() => {
      expect(screen.getByTestId('markdown-view')).toHaveTextContent('Vuln 20 fresh note');
    });
  });
});
