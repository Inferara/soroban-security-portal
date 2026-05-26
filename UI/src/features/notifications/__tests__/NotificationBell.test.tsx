import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { NotificationBell } from '../NotificationBell';
import { Notification, NotificationType, NotificationEntityType } from '../../../api/soroban-security-portal/models/notification';

// ---------------------------------------------------------------------------
// Mock useNavigate (keep real MemoryRouter for Link/etc, just override navigate)
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
// Mock useNotifications
// ---------------------------------------------------------------------------

const mockMarkRead = vi.fn();
const mockMarkAllRead = vi.fn();

const defaultHookResult = {
  notifications: [] as Notification[],
  unreadCount: 0,
  loading: false,
  markRead: mockMarkRead,
  markAllRead: mockMarkAllRead,
  reload: vi.fn(),
};

vi.mock('../useNotifications', () => ({
  useNotifications: vi.fn(() => defaultHookResult),
}));

import { useNotifications } from '../useNotifications';
const mockUseNotifications = useNotifications as ReturnType<typeof vi.fn>;

// ---------------------------------------------------------------------------
// Sample data
// ---------------------------------------------------------------------------

const VULN_NOTIFICATION: Notification = {
  id: 1,
  type: NotificationType.CommentReply,
  actorUserId: 10,
  actorName: 'Alice',
  commentId: 100,
  entityType: NotificationEntityType.Vulnerability,
  entityId: 5,
  preview: 'Nice finding!',
  isRead: false,
  createdAt: '2026-05-26T10:00:00Z',
};

const REPORT_NOTIFICATION: Notification = {
  id: 2,
  type: NotificationType.Mention,
  actorUserId: 11,
  actorName: 'Bob',
  commentId: 101,
  entityType: NotificationEntityType.Report,
  entityId: 7,
  preview: '@you check this',
  isRead: true,
  createdAt: '2026-05-26T09:00:00Z',
};

// ---------------------------------------------------------------------------
// Render helper
// ---------------------------------------------------------------------------

const theme = createTheme();

function renderBell() {
  return render(
    <MemoryRouter>
      <ThemeProvider theme={theme}>
        <NotificationBell />
      </ThemeProvider>
    </MemoryRouter>
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('NotificationBell', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseNotifications.mockReturnValue({ ...defaultHookResult });
  });

  // -------------------------------------------------------------------------
  // Badge shows unread count
  // -------------------------------------------------------------------------
  describe('badge', () => {
    it('shows the unreadCount in the badge', () => {
      mockUseNotifications.mockReturnValue({ ...defaultHookResult, unreadCount: 3 });
      renderBell();
      // MUI Badge renders the count as text
      expect(screen.getByText('3')).toBeInTheDocument();
    });

    it('renders the notification bell button', () => {
      renderBell();
      expect(screen.getByRole('button', { name: /notifications/i })).toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------------
  // Menu opens and lists items
  // -------------------------------------------------------------------------
  describe('menu', () => {
    it('is closed by default (menu items not visible)', () => {
      mockUseNotifications.mockReturnValue({
        ...defaultHookResult,
        notifications: [VULN_NOTIFICATION],
      });
      renderBell();
      expect(screen.queryByText('Alice')).not.toBeInTheDocument();
    });

    it('opens on bell click and lists notification actorName and preview', () => {
      mockUseNotifications.mockReturnValue({
        ...defaultHookResult,
        notifications: [VULN_NOTIFICATION, REPORT_NOTIFICATION],
      });
      renderBell();

      fireEvent.click(screen.getByRole('button', { name: /notifications/i }));

      expect(screen.getByText('Alice')).toBeInTheDocument();
      expect(screen.getByText('Nice finding!')).toBeInTheDocument();
      expect(screen.getByText('Bob')).toBeInTheDocument();
      expect(screen.getByText('@you check this')).toBeInTheDocument();
    });

    it('shows empty state text when notifications list is empty', () => {
      mockUseNotifications.mockReturnValue({ ...defaultHookResult, notifications: [] });
      renderBell();

      fireEvent.click(screen.getByRole('button', { name: /notifications/i }));

      expect(screen.getByText(/no notifications/i)).toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------------
  // Clicking a notification item
  // -------------------------------------------------------------------------
  describe('notification item click', () => {
    it('calls markRead with the notification id when clicked', () => {
      mockMarkRead.mockResolvedValue(undefined);
      mockUseNotifications.mockReturnValue({
        ...defaultHookResult,
        notifications: [VULN_NOTIFICATION],
        markRead: mockMarkRead,
      });
      renderBell();

      fireEvent.click(screen.getByRole('button', { name: /notifications/i }));
      fireEvent.click(screen.getByText('Alice'));

      expect(mockMarkRead).toHaveBeenCalledWith(1);
    });

    it('navigates to /vulnerability/{entityId} for Vulnerability entityType', () => {
      mockMarkRead.mockResolvedValue(undefined);
      mockUseNotifications.mockReturnValue({
        ...defaultHookResult,
        notifications: [VULN_NOTIFICATION],
        markRead: mockMarkRead,
      });
      renderBell();

      fireEvent.click(screen.getByRole('button', { name: /notifications/i }));
      fireEvent.click(screen.getByText('Alice'));

      expect(mockNavigate).toHaveBeenCalledWith('/vulnerability/5');
    });

    it('navigates to /report/{entityId} for Report entityType', () => {
      mockMarkRead.mockResolvedValue(undefined);
      mockUseNotifications.mockReturnValue({
        ...defaultHookResult,
        notifications: [REPORT_NOTIFICATION],
        markRead: mockMarkRead,
      });
      renderBell();

      fireEvent.click(screen.getByRole('button', { name: /notifications/i }));
      fireEvent.click(screen.getByText('Bob'));

      expect(mockNavigate).toHaveBeenCalledWith('/report/7');
    });

    it('closes the menu after clicking a notification item', () => {
      mockMarkRead.mockResolvedValue(undefined);
      mockUseNotifications.mockReturnValue({
        ...defaultHookResult,
        notifications: [VULN_NOTIFICATION],
        markRead: mockMarkRead,
      });
      renderBell();

      fireEvent.click(screen.getByRole('button', { name: /notifications/i }));
      // Menu is open — the MUI Menu paper has role="presentation" and is visible
      const menuPaper = screen.getByRole('presentation');
      expect(menuPaper).toBeVisible();

      fireEvent.click(screen.getByText('Alice'));
      // After close, the menu paper should no longer be in the document
      // (MUI Menu without keepMounted removes the portal on close)
      expect(screen.queryByRole('presentation')).not.toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------------
  // Mark all read
  // -------------------------------------------------------------------------
  describe('"Mark all read" action', () => {
    it('calls markAllRead when "Mark all read" is clicked', () => {
      mockMarkAllRead.mockResolvedValue(undefined);
      mockUseNotifications.mockReturnValue({
        ...defaultHookResult,
        notifications: [VULN_NOTIFICATION],
        markAllRead: mockMarkAllRead,
      });
      renderBell();

      fireEvent.click(screen.getByRole('button', { name: /notifications/i }));
      fireEvent.click(screen.getByText(/mark all read/i));

      expect(mockMarkAllRead).toHaveBeenCalledTimes(1);
    });
  });

  // -------------------------------------------------------------------------
  // Footer link to /mentions
  // -------------------------------------------------------------------------
  describe('footer mentions link', () => {
    it('navigates to /mentions when the footer link is clicked', () => {
      renderBell();

      fireEvent.click(screen.getByRole('button', { name: /notifications/i }));
      fireEvent.click(screen.getByText(/view all/i));

      expect(mockNavigate).toHaveBeenCalledWith('/mentions');
    });
  });
});
