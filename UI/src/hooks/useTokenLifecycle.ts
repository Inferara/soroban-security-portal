import { useEffect, useCallback, useRef, useState } from 'react';
import { useAuth } from 'react-oidc-context';
import { useNavigate } from 'react-router-dom';
import { environment } from '../environments/environment';

interface TokenLifecycleOptions {
  /** Time in seconds before expiration to show warning (default: 120) */
  warningThresholdSeconds?: number;
  /** Callback when session is about to expire */
  onSessionExpiring?: (secondsRemaining: number) => void;
  /** Callback when session has expired */
  onSessionExpired?: () => void;
  /** Callback when silent renewal fails */
  onRenewalFailed?: (error: Error) => void;
}

interface TokenLifecycleReturn {
  /** Whether the session is expiring soon */
  isSessionExpiring: boolean;
  /** Seconds until the session expires (null if not expiring) */
  secondsUntilExpiry: number | null;
  /** Attempt to extend the session via silent renewal */
  extendSession: () => Promise<void>;
  /** End the session and redirect to login */
  endSession: () => Promise<void>;
}

/**
 * Hook to manage token lifecycle events including expiration warnings and silent renewal.
 *
 * Features:
 * - Automatic silent token renewal
 * - Session expiration warnings
 * - Graceful handling of expired tokens
 * - Cross-tab session management
 *
 * @example
 * ```tsx
 * const { isSessionExpiring, secondsUntilExpiry, extendSession } = useTokenLifecycle({
 *   warningThresholdSeconds: 120,
 *   onSessionExpiring: (seconds) => console.log(`Session expiring in ${seconds}s`),
 *   onSessionExpired: () => console.log('Session expired'),
 * });
 * ```
 */
export const useTokenLifecycle = (options: TokenLifecycleOptions = {}): TokenLifecycleReturn => {
  const auth = useAuth();
  const navigate = useNavigate();
  const [isSessionExpiring, setIsSessionExpiring] = useState(false);
  const [secondsUntilExpiry, setSecondsUntilExpiry] = useState<number | null>(null);
  const renewalInProgressRef = useRef(false);

  const {
    warningThresholdSeconds = 120,
    onSessionExpiring,
    onSessionExpired,
    onRenewalFailed,
  } = options;

  // Handle session cleanup and redirect
  const handleSessionEnd = useCallback(async () => {
    const oidcStorageKey = `oidc.user:${environment.apiUrl}/api/v1/connect:${environment.clientId}`;
    localStorage.removeItem(oidcStorageKey);

    await auth.removeUser();
    setIsSessionExpiring(false);
    setSecondsUntilExpiry(null);

    // Redirect to home if on protected route
    if (window.location.pathname.startsWith(`${environment.basePath}/admin`)) {
      navigate('/');
    }
  }, [auth, navigate]);

  // Handle silent renewal with error handling
  const attemptSilentRenewal = useCallback(async () => {
    if (renewalInProgressRef.current) {
      return;
    }

    renewalInProgressRef.current = true;

    try {
      await auth.signinSilent();
      setIsSessionExpiring(false);
      setSecondsUntilExpiry(null);
    } catch (error) {
      console.error('Silent token renewal failed:', error);

      if (onRenewalFailed) {
        onRenewalFailed(error instanceof Error ? error : new Error(String(error)));
      }

      // If renewal fails, end the session
      await handleSessionEnd();
      onSessionExpired?.();
    } finally {
      renewalInProgressRef.current = false;
    }
  }, [auth, handleSessionEnd, onRenewalFailed, onSessionExpired]);

  // Check token expiration on mount
  useEffect(() => {
    if (!auth.user || auth.isLoading) return;

    const expiresAt = auth.user.expires_at;
    if (expiresAt && expiresAt < Date.now() / 1000) {
      console.warn('Session expired on load, removing user');
      handleSessionEnd();
    }
  }, [auth.user, auth.isLoading, handleSessionEnd]);

  // Subscribe to token expiring event
  useEffect(() => {
    const unsubscribe = auth.events.addAccessTokenExpiring(() => {
      setIsSessionExpiring(true);

      // Calculate remaining time
      const expiresAt = auth.user?.expires_at;
      if (expiresAt) {
        const remaining = Math.max(0, expiresAt - Date.now() / 1000);
        setSecondsUntilExpiry(Math.floor(remaining));
        onSessionExpiring?.(remaining);
      }

      // Attempt silent renewal
      attemptSilentRenewal();
    });

    return unsubscribe;
  }, [auth.events, auth.user?.expires_at, attemptSilentRenewal, onSessionExpiring]);

  // Subscribe to token expired event
  useEffect(() => {
    const unsubscribe = auth.events.addAccessTokenExpired(() => {
      console.warn('Access token has expired');
      setIsSessionExpiring(false);
      handleSessionEnd();
      onSessionExpired?.();
    });

    return unsubscribe;
  }, [auth.events, handleSessionEnd, onSessionExpired]);

  // Subscribe to silent renewal error event
  useEffect(() => {
    const unsubscribe = auth.events.addSilentRenewError((error) => {
      console.error('Silent renewal error:', error);
      onRenewalFailed?.(error instanceof Error ? error : new Error(String(error)));
      handleSessionEnd();
    });

    return unsubscribe;
  }, [auth.events, handleSessionEnd, onRenewalFailed]);

  // Proactive expiration warning timer
  useEffect(() => {
    if (!auth.user?.expires_at || !auth.isAuthenticated) {
      return;
    }

    const checkExpiration = () => {
      const expiresAt = auth.user?.expires_at;
      if (!expiresAt) return;

      const secondsRemaining = expiresAt - Date.now() / 1000;

      if (secondsRemaining <= warningThresholdSeconds && secondsRemaining > 0) {
        setIsSessionExpiring(true);
        setSecondsUntilExpiry(Math.floor(secondsRemaining));
        onSessionExpiring?.(secondsRemaining);
      } else if (secondsRemaining <= 0) {
        handleSessionEnd();
        onSessionExpired?.();
      }
    };

    // Check immediately
    checkExpiration();

    // Then check every 10 seconds
    const interval = setInterval(checkExpiration, 10000);

    return () => clearInterval(interval);
  }, [
    auth.user?.expires_at,
    auth.isAuthenticated,
    warningThresholdSeconds,
    handleSessionEnd,
    onSessionExpiring,
    onSessionExpired,
  ]);

  return {
    isSessionExpiring,
    secondsUntilExpiry,
    extendSession: attemptSilentRenewal,
    endSession: handleSessionEnd,
  };
};
