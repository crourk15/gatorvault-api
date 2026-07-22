'use client';

import React, { useEffect, useState } from 'react';
import { isNativeApp } from '@/lib/api-base';
import '@/lib/native-shell.css';

/** No-op on web; initializes Capacitor chrome on iOS/Android. */
export function NativeShellInit(): React.ReactElement | null {
  const [offline, setOffline] = useState(false);
  const [shellReady, setShellReady] = useState(false);

  useEffect(() => {
    if (!isNativeApp()) return;
    void import('@/lib/native-shell').then(({ initNativeShell }) => initNativeShell());

    const markReady = () => {
      if (document.querySelector('.gv-vault-shell, .gv-join-shell, [data-testid]')) {
        setShellReady(true);
      }
    };
    markReady();
    const timer = window.setTimeout(() => setShellReady(true), 1200);

    const sync = () => setOffline(typeof navigator !== 'undefined' && !navigator.onLine);
    sync();
    window.addEventListener('online', sync);
    window.addEventListener('offline', sync);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('online', sync);
      window.removeEventListener('offline', sync);
    };
  }, []);

  if (!isNativeApp() || !offline) return null;

  return (
    <div className="gv-native-offline-banner" role="status" aria-live="polite">
      {shellReady
        ? 'You’re offline — showing saved vault shell.'
        : 'You’re offline — reconnect to load vault data.'}
    </div>
  );
}
