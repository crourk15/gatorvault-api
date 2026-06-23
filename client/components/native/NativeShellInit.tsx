'use client';

import React, { useEffect } from 'react';
import { isNativeApp } from '@/lib/api-base';
import '@/lib/native-shell.css';

/** No-op on web; initializes Capacitor chrome on iOS/Android. */
export function NativeShellInit(): null {
  useEffect(() => {
    if (!isNativeApp()) return;
    void import('@/lib/native-shell').then(({ initNativeShell }) => initNativeShell());
  }, []);

  return null;
}
