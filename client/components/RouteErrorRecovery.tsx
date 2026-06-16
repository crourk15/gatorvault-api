'use client';

import { useEffect } from 'react';
import { isChunkLoadError, recoverFromChunkError } from '@/lib/chunk-error-recovery';

/** Global listeners — auto cache-bust reload on chunk load failures (once per path). */
export function RouteErrorRecovery(): null {
  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      const err = event.error ?? event.message;
      if (!isChunkLoadError(err)) return;
      if (recoverFromChunkError()) event.preventDefault();
    };

    const handleRejection = (event: PromiseRejectionEvent) => {
      if (!isChunkLoadError(event.reason)) return;
      if (recoverFromChunkError()) event.preventDefault();
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleRejection);
    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleRejection);
    };
  }, []);

  return null;
}
