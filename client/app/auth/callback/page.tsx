'use client';

import React, { useEffect } from 'react';
import {
  saveSession,
  safeAuthRedirectPath,
  replaceAuthLocation,
  type AuthSession,
} from '@/lib/auth-api';

/**
 * OAuth / magic-link callback — stores session from query hash or search params.
 * Whitelisted in VaultRouteGate so users are not bounced before tokens land.
 */
export default function AuthCallbackPage(): React.ReactElement {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token') || params.get('access_token');
    const email = params.get('email');
    if (token && email) {
      const session: AuthSession = {
        token,
        email: email.trim().toLowerCase(),
        tier: params.get('tier') || 'film',
        name: params.get('name') || undefined,
      };
      saveSession(session);
      try {
        sessionStorage.setItem('gv_auth_handoff', '1');
      } catch {
        /* ignore */
      }
      const next = params.get('next');
      const dest = safeAuthRedirectPath(next, '/vault/');
      replaceAuthLocation(dest);
      return;
    }
    replaceAuthLocation('/join/?mode=signin');
  }, []);

  return (
    <p style={{ padding: '2rem', textAlign: 'center' }} data-testid="auth-callback">
      Completing sign-in…
    </p>
  );
}
