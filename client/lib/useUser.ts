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
    setUser(loadSession());
    setReady(true);
  }, []);

  return {
    user,
    isInsider: isFutureCastInsider(user),
    ready,
  };
}
