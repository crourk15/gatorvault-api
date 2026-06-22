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
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    initGvHydrate();
    const id = testId ?? `rh-lazy-${Math.random().toString(36).slice(2, 8)}`;

    if (priority === 'top-fold') {
      window.__GV_HYDRATE__?.(id, () => setVisible(true), 'top-fold');
      return undefined;
    }

    const el = ref.current;
    if (!el || visible) return undefined;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          observer.disconnect();
          window.__GV_HYDRATE__?.(id, () => setVisible(true), 'below-fold');
        }
      },
      { rootMargin: '200px' }
    );

    observer.observe(el);
    return () => observer.disconnect();
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
