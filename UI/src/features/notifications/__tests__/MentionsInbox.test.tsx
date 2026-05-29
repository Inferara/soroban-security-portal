import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { MentionsInbox } from '../MentionsInbox';
import { Notification, NotificationType, NotificationEntityType } from '../../../api/soroban-security-portal/models/notification';

// ---------------------------------------------------------------------------
// Mock navigate
// ---------------------------------------------------------------------------

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// ---------------------------------------------------------------------------
// Mock API calls
// ---------------------------------------------------------------------------

const mockGetNotificationsCall = vi.fn();
const mockMarkNotificationReadCall = vi.fn();

vi.mock('../../../api/soroban-security-portal/soroban-security-portal-api', () => ({
  getNotificationsCall: (...args: unknown[]) => mockGetNotificationsCall(...args),
  markNotificationReadCall: (...args: unknown[]) => mockMarkNotificationReadCall(...args),
}));

// ---------------------------------------------------------------------------
// Sample data
// ---------------------------------------------------------------------------

const MENTION_VULN: Notification = {
  id: 10,
  type: NotificationType.Mention,
  actorUserId: 20,
  actorName: 'Charlie',
  commentId: 200,
  entityType: NotificationEntityType.Vulnerability,
  entityId: 42,
  preview: 'Hey @you, check this vuln',
  isRead: false,
  createdAt: '2026-05-27T08:00:00Z',
};

const MENTION_REPORT: Notification = {
  id: 11,
  type: NotificationType.Mention,
  actorUserId: 21,
  actorName: 'Dana',
  commentId: 201,
  entityType: NotificationEntityType.Report,
  entityId: 7,
  preview: '@you referenced in report',
  isRead: true,
  createdAt: '2026-05-27T07:00:00Z',
};

// ---------------------------------------------------------------------------
// Render helper
// ---------------------------------------------------------------------------

const theme = createTheme();

function renderInbox() {
  return render(
    <MemoryRouter>
      <ThemeProvider theme={theme}>
        <MentionsInbox />
      </ThemeProvider>
    </MemoryRouter>
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('MentionsInbox', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMarkNotificationReadCall.mockResolvedValue(undefined);
  });

  // -------------------------------------------------------------------------
  // Heading
  // -------------------------------------------------------------------------
  it('renders a heading for the mentions inbox', async () => {
    mockGetNotificationsCall.mockResolvedValue([]);
    renderInbox();
    await waitFor(() => expect(screen.getByRole('heading')).toBeInTheDocument());
  });

  // -------------------------------------------------------------------------
  // Lists mention items
  // -------------------------------------------------------------------------
  it('lists mention notifications with actorName and preview', async () => {
    mockGetNotificationsCall.mockResolvedValue([MENTION_VULN, MENTION_REPORT]);
    renderInbox();

    await waitFor(() => {
      expect(screen.getByText('Charlie')).toBeInTheDocument();
      expect(screen.getByText('Hey @you, check this vuln')).toBeInTheDocument();
      expect(screen.getByText('Dana')).toBeInTheDocument();
      expect(screen.getByText('@you referenced in report')).toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------------
  // Calls getNotificationsCall with Mention type
  // -------------------------------------------------------------------------
  it('calls getNotificationsCall with NotificationType.Mention', async () => {
    mockGetNotificationsCall.mockResolvedValue([]);
    renderInbox();

    await waitFor(() => {
      expect(mockGetNotificationsCall).toHaveBeenCalledWith(NotificationType.Mention, 1);
    });
  });

  // -------------------------------------------------------------------------
  // Empty state
  // -------------------------------------------------------------------------
  it('shows an empty state message when there are no mentions', async () => {
    mockGetNotificationsCall.mockResolvedValue([]);
    renderInbox();

    await waitFor(() => {
      expect(screen.getByText(/no mentions/i)).toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------------
  // Clicking an item navigates to the entity route
  // -------------------------------------------------------------------------
  it('navigates to /vulnerability/{entityId} when a Vulnerability mention is clicked', async () => {
    mockGetNotificationsCall.mockResolvedValue([MENTION_VULN]);
    renderInbox();

    await waitFor(() => expect(screen.getByText('Charlie')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Charlie'));

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/vulnerability/42'));
  });

  it('navigates to /report/{entityId} when a Report mention is clicked', async () => {
    mockGetNotificationsCall.mockResolvedValue([MENTION_REPORT]);
    renderInbox();

    await waitFor(() => expect(screen.getByText('Dana')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Dana'));

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/report/7'));
  });

  // -------------------------------------------------------------------------
  // Clicking an item calls markNotificationReadCall
  // -------------------------------------------------------------------------
  it('calls markNotificationReadCall with the notification id when an item is clicked', async () => {
    mockGetNotificationsCall.mockResolvedValue([MENTION_VULN]);
    renderInbox();

    await waitFor(() => expect(screen.getByText('Charlie')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Charlie'));

    expect(mockMarkNotificationReadCall).toHaveBeenCalledWith(10);
  });
});
