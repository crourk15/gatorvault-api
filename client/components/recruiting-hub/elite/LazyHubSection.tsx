'use client';

import React, { useEffect, useRef, useState } from 'react';
import { initGvHydrate } from '@/lib/gv-hydrate';

type LazyHubSectionProps = {
  children: React.ReactNode;
  /** Placeholder min-height to limit layout shift before mount. */
  minHeight?: number;
  className?: string;
  testId?: string;
  /** top-fold = idle hydrate; below-fold = IntersectionObserver (default). */
  priority?: 'top-fold' | 'below-fold';
};

/** Hub section — top-fold idle hydrate or below-fold when near viewport. */
export function LazyHubSection({
  children,
  minHeight = 120,
  className,
  testId,
  priority = 'below-fold',
}: LazyHubSectionProps): React.ReactElement {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(priority === 'top-fold');

  useEffect(() => {
    if (priority === 'top-fold') return undefined;

    initGvHydrate();
    const id = testId ?? `rh-lazy-${Math.random().toString(36).slice(2, 8)}`;
    let observer: IntersectionObserver | null = null;
    const el = ref.current;

    if (el && !visible) {
      observer = new IntersectionObserver(
        ([entry]) => {
          if (entry?.isIntersecting) {
            observer?.disconnect();
            window.__GV_HYDRATE__?.(id, () => setVisible(true), 'below-fold');
          }
        },
        { rootMargin: '200px' }
      );
      observer.observe(el);
    }

    const isMobile =
      typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches;
    const fallbackMs = isMobile ? 4_000 : 12_000;
    const fallback = window.setTimeout(() => setVisible(true), fallbackMs);
    return () => {
      observer?.disconnect();
      window.clearTimeout(fallback);
    };
  }, [priority, testId, visible]);

  if (visible) {
    return <>{children}</>;
  }

  return (
    <div ref={ref} className={className ?? 'rh-lazy-section'} data-testid={testId} aria-hidden="true">
      <div className="rh-skeleton" style={{ minHeight }} />
    </div>
  );
}
