import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Profile } from '../profile';
import * as api from '../../../../../api/soroban-security-portal/soroban-security-portal-api';
import { showError } from '../../../../dialog-handler/dialog-handler';

const mockNavigate = vi.fn();
const mockUseProfile = vi.fn();

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock('../hooks', () => ({
  useProfile: () => mockUseProfile(),
}));

vi.mock('../../../../../contexts/BookmarkContext', () => ({
  useBookmarks: () => ({
    bookmarks: [],
    removeBookmark: vi.fn(),
  }),
}));

vi.mock('../../../../../components/MarkdownView', () => ({
  MarkdownView: ({ content }: { content: string }) => (
    <div data-testid="markdown-view">{content}</div>
  ),
}));

vi.mock('../../../../../components/BadgeShowcase', () => ({
  BadgeShowcase: () => <div data-testid="badge-showcase" />,
}));

vi.mock('../../../../dialog-handler/dialog-handler', () => ({
  showSuccess: vi.fn(),
  showError: vi.fn(),
}));

describe('Profile Personal Notes Tab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('displays the Notes tab in the user personal profile space (userId === 0) and allows managing notes', async () => {
    mockUseProfile.mockReturnValue({
      user: {
        fullName: 'Alice Auditor',
        role: 'user',
        created: '2026-01-01T00:00:00Z',
        personalInfo: 'Auditor bio',
        connectedAccounts: [],
      },
      userId: 0,
    });

    vi.spyOn(api, 'getPersonalNotesCall').mockResolvedValue([
      {
        id: 11,
        vulnerabilityId: 42,
        content: 'Check token allowance underflow',
        createdAt: '2026-06-01T00:00:00Z',
        updatedAt: '2026-06-01T00:00:00Z',
        title: 'Token Allowance Underflow',
        description: 'Details',
        severity: 'High',
      },
    ]);
    const deleteSpy = vi.spyOn(api, 'deletePersonalNoteCall').mockResolvedValue();

    render(<Profile />);

    const notesTab = screen.getByRole('tab', { name: /notes/i });
    fireEvent.click(notesTab);

    expect(await screen.findByText('Token Allowance Underflow')).toBeInTheDocument();
    expect(screen.getByText('Check token allowance underflow')).toBeInTheDocument();

    const openBtn = screen.getByRole('button', { name: /open vulnerability/i });
    fireEvent.click(openBtn);
    expect(mockNavigate).toHaveBeenCalledWith('/vulnerability/42');

    const deleteBtn = screen.getByRole('button', { name: /remove personal note/i });
    fireEvent.click(deleteBtn);

    // Nothing is deleted until the confirm dialog is accepted
    expect(await screen.findByText('Delete personal note?')).toBeInTheDocument();
    expect(deleteSpy).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /^delete$/i }));

    await waitFor(() => {
      expect(deleteSpy).toHaveBeenCalledWith(11);
    });
    await waitFor(() => {
      expect(screen.queryByText('Token Allowance Underflow')).not.toBeInTheDocument();
    });
  });

  it('lists notes on hidden or deleted vulnerabilities as read-only but still deletable', async () => {
    mockUseProfile.mockReturnValue({
      user: {
        fullName: 'Alice Auditor',
        role: 'user',
        created: '2026-01-01T00:00:00Z',
        personalInfo: '',
        connectedAccounts: [],
      },
      userId: 0,
    });

    vi.spyOn(api, 'getPersonalNotesCall').mockResolvedValue([
      {
        id: 12,
        vulnerabilityId: 77,
        content: 'Note on a hidden vulnerability',
        createdAt: '2026-06-01T00:00:00Z',
        updatedAt: '2026-06-01T00:00:00Z',
        isVulnerabilityAvailable: false,
        title: '',
        description: '',
        severity: '',
      },
    ]);
    const deleteSpy = vi.spyOn(api, 'deletePersonalNoteCall').mockResolvedValue();

    render(<Profile />);
    fireEvent.click(screen.getByRole('tab', { name: /notes/i }));

    expect(await screen.findByText('Vulnerability #77')).toBeInTheDocument();
    expect(screen.getByText('No longer available')).toBeInTheDocument();
    expect(screen.getByText('Note on a hidden vulnerability')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /open vulnerability/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /edit personal note/i })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /remove personal note/i }));
    fireEvent.click(await screen.findByRole('button', { name: /^delete$/i }));

    await waitFor(() => {
      expect(deleteSpy).toHaveBeenCalledWith(12);
    });
  });

  it('does not show a second error popup when removing a note fails', async () => {
    mockUseProfile.mockReturnValue({
      user: {
        fullName: 'Alice Auditor',
        role: 'user',
        created: '2026-01-01T00:00:00Z',
        personalInfo: '',
        connectedAccounts: [],
      },
      userId: 0,
    });

    vi.spyOn(api, 'getPersonalNotesCall').mockResolvedValue([
      {
        id: 13,
        vulnerabilityId: 5,
        content: 'Still here',
        createdAt: '2026-06-01T00:00:00Z',
        updatedAt: '2026-06-01T00:00:00Z',
        isVulnerabilityAvailable: true,
        title: 'Some Vulnerability',
        description: '',
        severity: 'Low',
      },
    ]);
    // RestApi.request shows its own popup and then throws
    const deleteSpy = vi
      .spyOn(api, 'deletePersonalNoteCall')
      .mockRejectedValue(new Error('API call failed: boom (Status: 500)'));

    render(<Profile />);
    fireEvent.click(screen.getByRole('tab', { name: /notes/i }));

    fireEvent.click(await screen.findByRole('button', { name: /remove personal note/i }));
    fireEvent.click(await screen.findByRole('button', { name: /^delete$/i }));

    await waitFor(() => {
      expect(deleteSpy).toHaveBeenCalledWith(13);
    });
    expect(showError).not.toHaveBeenCalled();
    expect(screen.getByText('Still here')).toBeInTheDocument();
  });

  it('hides the Notes tab when viewing another user profile (userId !== 0)', () => {
    mockUseProfile.mockReturnValue({
      user: {
        fullName: 'Other User',
        role: 'user',
        created: '2026-01-01T00:00:00Z',
        personalInfo: '',
        connectedAccounts: [],
      },
      userId: 99,
    });
    const getNotesSpy = vi.spyOn(api, 'getPersonalNotesCall');

    render(<Profile />);

    expect(screen.queryByRole('tab', { name: /notes/i })).not.toBeInTheDocument();
    expect(getNotesSpy).not.toHaveBeenCalled();
  });
});
