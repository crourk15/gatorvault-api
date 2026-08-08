'use client';

import { useEffect } from 'react';
import { captureFirstTouchAttribution } from '@/lib/first-touch-attribution';

/** Mount once in AppProviders — silent first-touch UTM/referrer capture. */
export function FirstTouchCapture(): null {
  useEffect(() => {
    captureFirstTouchAttribution();
  }, []);
  return null;
}
