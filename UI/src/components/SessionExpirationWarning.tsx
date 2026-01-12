import { FC, useEffect, useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  CircularProgress,
  Box,
} from '@mui/material';
import { useTokenLifecycle } from '../hooks/useTokenLifecycle';

interface SessionExpirationWarningProps {
  /** Time in seconds before expiration to show warning (default: 120) */
  warningThresholdSeconds?: number;
}

/**
 * Dialog that warns users when their session is about to expire.
 * Provides options to extend the session or log out.
 *
 * @example
 * ```tsx
 * // Add to app layout
 * <SessionExpirationWarning warningThresholdSeconds={120} />
 * ```
 */
export const SessionExpirationWarning: FC<SessionExpirationWarningProps> = ({
  warningThresholdSeconds = 120,
}) => {
  const [showWarning, setShowWarning] = useState(false);
  const [isExtending, setIsExtending] = useState(false);
  const [countdown, setCountdown] = useState(0);

  const { isSessionExpiring, extendSession, endSession } = useTokenLifecycle({
    warningThresholdSeconds,
    onSessionExpiring: (seconds) => {
      if (seconds <= warningThresholdSeconds) {
        setShowWarning(true);
        setCountdown(Math.floor(seconds));
      }
    },
    onSessionExpired: () => {
      setShowWarning(false);
    },
  });

  // Update countdown timer
  useEffect(() => {
    if (!showWarning || !isSessionExpiring) return;

    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [showWarning, isSessionExpiring]);

  // Close dialog if session was renewed
  useEffect(() => {
    if (!isSessionExpiring && showWarning) {
      setShowWarning(false);
      setIsExtending(false);
    }
  }, [isSessionExpiring, showWarning]);

  const handleExtendSession = async () => {
    setIsExtending(true);
    try {
      await extendSession();
      setShowWarning(false);
    } catch (error) {
      // Error handling is done in the hook
    } finally {
      setIsExtending(false);
    }
  };

  const handleLogout = async () => {
    setShowWarning(false);
    await endSession();
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins > 0) {
      return `${mins}m ${secs}s`;
    }
    return `${secs}s`;
  };

  return (
    <Dialog
      open={showWarning}
      onClose={() => {}} // Prevent closing by clicking outside
      maxWidth="sm"
      fullWidth
      aria-labelledby="session-expiring-title"
      aria-describedby="session-expiring-description"
    >
      <DialogTitle id="session-expiring-title" sx={{ pb: 1 }}>
        Session Expiring Soon
      </DialogTitle>
      <DialogContent>
        <Box sx={{ textAlign: 'center', py: 2 }}>
          <Typography
            variant="h4"
            color="warning.main"
            sx={{ mb: 2 }}
            aria-live="polite"
          >
            {formatTime(countdown)}
          </Typography>
          <Typography variant="body1" id="session-expiring-description">
            Your session will expire soon. Would you like to extend your session?
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Any unsaved changes may be lost if your session expires.
          </Typography>
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={handleLogout} color="inherit" disabled={isExtending}>
          Log Out
        </Button>
        <Button
          onClick={handleExtendSession}
          variant="contained"
          disabled={isExtending}
          startIcon={
            isExtending ? <CircularProgress size={16} color="inherit" /> : null
          }
        >
          {isExtending ? 'Extending...' : 'Stay Logged In'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
