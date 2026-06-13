/**
 * IntersectionObserver hook — calls callback when sentinel enters viewport.
 */
import React, { useEffect, useRef } from 'react';

export function useInfiniteScroll(callback: () => void): React.RefObject<HTMLDivElement | null> {
  const callbackRef = useRef(callback);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const first = entries[0];
        if (first?.isIntersecting) {
          callbackRef.current();
        }
      },
      { threshold: 0.25, rootMargin: '120px' }
    );

    observer.observe(el);
    return () => observer.disconnect();
  });

  return sentinelRef;
}
