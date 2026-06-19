'use client';

import { useSyncExternalStore } from 'react';
import { MOBILE_MEDIA_QUERY } from '@/lib/viewport-breakpoints';

function subscribe(onStoreChange: () => void): () => void {
  const media = window.matchMedia(MOBILE_MEDIA_QUERY);
  media.addEventListener('change', onStoreChange);
  return () => media.removeEventListener('change', onStoreChange);
}

function getSnapshot(): boolean {
  return window.matchMedia(MOBILE_MEDIA_QUERY).matches;
}

function getServerSnapshot(): boolean {
  return false;
}

/** True when viewport width is ≤767px (CSS mobile breakpoint, not device UA). */
export function useMobileViewport(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
