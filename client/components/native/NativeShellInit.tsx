'use client';

import React, { useEffect, useState } from 'react';
import { isNativeApp } from '@/lib/api-base';
import '@/lib/native-shell.css';

/** No-op on web; initializes Capacitor chrome on iOS/Android. */
export function NativeShellInit(): React.ReactElement | null {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    if (!isNativeApp()) return;
    void import('@/lib/native-shell').then(({ initNativeShell }) => initNativeShell());

    const sync = () => setOffline(typeof navigator !== 'undefined' && !navigator.onLine);
    sync();
    window.addEventListener('online', sync);
    window.addEventListener('offline', sync);
    return () => {
      window.removeEventListener('online', sync);
      window.removeEventListener('offline', sync);
    };
  }, []);

  if (!isNativeApp() || !offline) return null;

  return (
    <div className="gv-native-offline-banner" role="status" aria-live="polite">
      You’re offline — showing saved vault shell.
    </div>
  );
}
