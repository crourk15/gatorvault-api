'use client';

import { useEffect, useState } from 'react';
import { loadSession, type AuthSession } from './auth-api';
import { isFutureCastInsider } from './futurecast-insider';

export function useUser(): {
  user: AuthSession | null;
  isInsider: boolean;
  ready: boolean;
} {
  const [user, setUser] = useState<AuthSession | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const sync = () => {
      setUser(loadSession());
      setReady(true);
    };
    sync();
    window.addEventListener('storage', sync);
    window.addEventListener('gv-auth-changed', sync);
    return () => {
      window.removeEventListener('storage', sync);
      window.removeEventListener('gv-auth-changed', sync);
    };
  }, []);

  return {
    user,
    isInsider: isFutureCastInsider(user),
    ready,
  };
}
