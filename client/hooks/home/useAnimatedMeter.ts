'use client';

import { useEffect, useState } from 'react';

/** Animates a percentage width from 0 → target after mount. */
export function useAnimatedMeter(target: number, durationMs = 800): number {
  const clamped = Math.min(100, Math.max(0, target));
  const [width, setWidth] = useState(0);

  useEffect(() => {
    setWidth(0);
    const id = window.requestAnimationFrame(() => {
      setWidth(clamped);
    });
    return () => window.cancelAnimationFrame(id);
  }, [clamped, durationMs]);

  return width;
}
