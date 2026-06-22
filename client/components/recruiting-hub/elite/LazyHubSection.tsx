'use client';

import React, { useEffect, useRef, useState } from 'react';

type LazyHubSectionProps = {
  children: React.ReactNode;
  /** Placeholder min-height to limit layout shift before mount. */
  minHeight?: number;
  className?: string;
  testId?: string;
};

/** Below-fold hub section — mounts when near viewport. */
export function LazyHubSection({
  children,
  minHeight = 120,
  className,
  testId,
}: LazyHubSectionProps): React.ReactElement {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || visible) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '200px' }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [visible]);

  if (visible) {
    return <>{children}</>;
  }

  return (
    <div ref={ref} className={className ?? 'rh-lazy-section'} data-testid={testId} aria-hidden="true">
      <div className="rh-skeleton" style={{ minHeight }} />
    </div>
  );
}
