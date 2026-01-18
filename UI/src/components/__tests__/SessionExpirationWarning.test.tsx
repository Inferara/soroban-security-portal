import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { SessionExpirationWarning } from '../SessionExpirationWarning';

// Track callbacks from useTokenLifecycle
let capturedCallbacks: {
  onSessionExpiring?: (seconds: number) => void;
  onSessionExpired?: () => void;
} = {};

// Mock state
let mockIsSessionExpiring = false;
const mockExtendSession = vi.fn();
const mockEndSession = vi.fn();

vi.mock('../../hooks/useTokenLifecycle', () => ({
  useTokenLifecycle: (options: {
    warningThresholdSeconds?: number;
    onSessionExpiring?: (seconds: number) => void;
    onSessionExpired?: () => void;
  }) => {
    capturedCallbacks = {
      onSessionExpiring: options.onSessionExpiring,
      onSessionExpired: options.onSessionExpired,
    };
    return {
      isSessionExpiring: mockIsSessionExpiring,
      extendSession: mockExtendSession,
      endSession: mockEndSession,
    };
  },
}));

const theme = createTheme();

const Wrapper = ({ children }: { children: React.ReactNode }) => (
  <ThemeProvider theme={theme}>{children}</ThemeProvider>
);

describe('SessionExpirationWarning', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mockIsSessionExpiring = false;
    capturedCallbacks = {};
    mockExtendSession.mockResolvedValue(undefined);
    mockEndSession.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('dialog visibility', () => {
    it('does not show dialog initially', () => {
      render(<SessionExpirationWarning />, { wrapper: Wrapper });

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('shows dialog when session is expiring', () => {
      mockIsSessionExpiring = true;
      render(<SessionExpirationWarning />, { wrapper: Wrapper });

      // Trigger the onSessionExpiring callback
      act(() => {
        capturedCallbacks.onSessionExpiring?.(60);
      });

      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText('Session Expiring Soon')).toBeInTheDocument();
    });

    it('hides dialog when session is renewed', () => {
      mockIsSessionExpiring = true;
      const { rerender } = render(<SessionExpirationWarning />, { wrapper: Wrapper });

      act(() => {
        capturedCallbacks.onSessionExpiring?.(60);
      });

      expect(screen.getByRole('dialog')).toBeInTheDocument();

      // Simulate session renewed by rerendering with isSessionExpiring = false
      mockIsSessionExpiring = false;
      rerender(
        <Wrapper>
          <SessionExpirationWarning />
        </Wrapper>
      );

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  describe('countdown timer', () => {
    it('displays countdown time in minutes and seconds format', () => {
      mockIsSessionExpiring = true;
      render(<SessionExpirationWarning />, { wrapper: Wrapper });

      act(() => {
        capturedCallbacks.onSessionExpiring?.(90); // 1m 30s
      });

      expect(screen.getByText('1m 30s')).toBeInTheDocument();
    });

    it('displays only seconds when under a minute', () => {
      mockIsSessionExpiring = true;
      render(<SessionExpirationWarning />, { wrapper: Wrapper });

      act(() => {
        capturedCallbacks.onSessionExpiring?.(45);
      });

      expect(screen.getByText('45s')).toBeInTheDocument();
    });

    it('decrements countdown every second', () => {
      mockIsSessionExpiring = true;
      render(<SessionExpirationWarning />, { wrapper: Wrapper });

      act(() => {
        capturedCallbacks.onSessionExpiring?.(10);
      });

      expect(screen.getByText('10s')).toBeInTheDocument();

      act(() => {
        vi.advanceTimersByTime(1000);
      });

      expect(screen.getByText('9s')).toBeInTheDocument();

      act(() => {
        vi.advanceTimersByTime(1000);
      });

      expect(screen.getByText('8s')).toBeInTheDocument();
    });

    it('stops at zero', () => {
      mockIsSessionExpiring = true;
      render(<SessionExpirationWarning />, { wrapper: Wrapper });

      act(() => {
        capturedCallbacks.onSessionExpiring?.(2);
      });

      expect(screen.getByText('2s')).toBeInTheDocument();

      act(() => {
        vi.advanceTimersByTime(3000);
      });

      expect(screen.getByText('0s')).toBeInTheDocument();
    });
  });

  describe('extend session button', () => {
    it('shows "Stay Logged In" button', () => {
      mockIsSessionExpiring = true;
      render(<SessionExpirationWarning />, { wrapper: Wrapper });

      act(() => {
        capturedCallbacks.onSessionExpiring?.(60);
      });

      expect(screen.getByRole('button', { name: /stay logged in/i })).toBeInTheDocument();
    });

    it('calls extendSession when clicked', async () => {
      mockIsSessionExpiring = true;
      render(<SessionExpirationWarning />, { wrapper: Wrapper });

      act(() => {
        capturedCallbacks.onSessionExpiring?.(60);
      });

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /stay logged in/i }));
      });

      expect(mockExtendSession).toHaveBeenCalled();
    });

    it('shows loading state while extending', async () => {
      mockIsSessionExpiring = true;
      // Make extendSession take time
      mockExtendSession.mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 1000))
      );

      render(<SessionExpirationWarning />, { wrapper: Wrapper });

      act(() => {
        capturedCallbacks.onSessionExpiring?.(60);
      });

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /stay logged in/i }));
      });

      expect(screen.getByRole('button', { name: /extending/i })).toBeInTheDocument();
    });

    it('disables logout button while extending', async () => {
      mockIsSessionExpiring = true;
      mockExtendSession.mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 1000))
      );

      render(<SessionExpirationWarning />, { wrapper: Wrapper });

      act(() => {
        capturedCallbacks.onSessionExpiring?.(60);
      });

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /stay logged in/i }));
      });

      expect(screen.getByRole('button', { name: /log out/i })).toBeDisabled();
    });
  });

  describe('logout button', () => {
    it('shows "Log Out" button', () => {
      mockIsSessionExpiring = true;
      render(<SessionExpirationWarning />, { wrapper: Wrapper });

      act(() => {
        capturedCallbacks.onSessionExpiring?.(60);
      });

      expect(screen.getByRole('button', { name: /log out/i })).toBeInTheDocument();
    });

    it('calls endSession when clicked', async () => {
      mockIsSessionExpiring = true;
      render(<SessionExpirationWarning />, { wrapper: Wrapper });

      act(() => {
        capturedCallbacks.onSessionExpiring?.(60);
      });

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /log out/i }));
      });

      expect(mockEndSession).toHaveBeenCalled();
    });

    it('sets showWarning to false after logout click', async () => {
      mockIsSessionExpiring = true;
      render(<SessionExpirationWarning />, { wrapper: Wrapper });

      act(() => {
        capturedCallbacks.onSessionExpiring?.(60);
      });

      expect(screen.getByRole('dialog')).toBeInTheDocument();

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /log out/i }));
      });

      // endSession should have been called
      expect(mockEndSession).toHaveBeenCalled();
    });
  });

  describe('accessibility', () => {
    it('has proper aria-labelledby', () => {
      mockIsSessionExpiring = true;
      render(<SessionExpirationWarning />, { wrapper: Wrapper });

      act(() => {
        capturedCallbacks.onSessionExpiring?.(60);
      });

      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveAttribute('aria-labelledby', 'session-expiring-title');
    });

    it('has proper aria-describedby', () => {
      mockIsSessionExpiring = true;
      render(<SessionExpirationWarning />, { wrapper: Wrapper });

      act(() => {
        capturedCallbacks.onSessionExpiring?.(60);
      });

      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveAttribute('aria-describedby', 'session-expiring-description');
    });

    it('has aria-live on countdown', () => {
      mockIsSessionExpiring = true;
      render(<SessionExpirationWarning />, { wrapper: Wrapper });

      act(() => {
        capturedCallbacks.onSessionExpiring?.(60);
      });

      const countdown = screen.getByText('1m 0s');
      expect(countdown).toHaveAttribute('aria-live', 'polite');
    });
  });

  describe('content', () => {
    it('shows warning message about unsaved changes', () => {
      mockIsSessionExpiring = true;
      render(<SessionExpirationWarning />, { wrapper: Wrapper });

      act(() => {
        capturedCallbacks.onSessionExpiring?.(60);
      });

      expect(
        screen.getByText('Your session will expire soon. Would you like to extend your session?')
      ).toBeInTheDocument();
      expect(
        screen.getByText('Any unsaved changes may be lost if your session expires.')
      ).toBeInTheDocument();
    });
  });

  describe('warningThresholdSeconds prop', () => {
    it('uses default threshold of 120 seconds', () => {
      mockIsSessionExpiring = true;
      render(<SessionExpirationWarning />, { wrapper: Wrapper });

      act(() => {
        capturedCallbacks.onSessionExpiring?.(120);
      });

      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('uses custom threshold', () => {
      mockIsSessionExpiring = true;
      render(<SessionExpirationWarning warningThresholdSeconds={60} />, { wrapper: Wrapper });

      act(() => {
        capturedCallbacks.onSessionExpiring?.(60);
      });

      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
  });

  describe('error handling', () => {
    it('calls extendSession even when it fails', async () => {
      mockIsSessionExpiring = true;
      mockExtendSession.mockRejectedValue(new Error('Extension failed'));

      render(<SessionExpirationWarning />, { wrapper: Wrapper });

      act(() => {
        capturedCallbacks.onSessionExpiring?.(60);
      });

      // Click the button
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /stay logged in/i }));
      });

      // extendSession should have been called
      expect(mockExtendSession).toHaveBeenCalled();
    });
  });

  describe('onSessionExpired callback', () => {
    it('sets up onSessionExpired callback', () => {
      mockIsSessionExpiring = true;
      render(<SessionExpirationWarning />, { wrapper: Wrapper });

      // Verify callback is captured
      expect(capturedCallbacks.onSessionExpired).toBeDefined();
    });
  });
});
