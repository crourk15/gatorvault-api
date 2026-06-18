'use client';

import React, { useEffect, useRef, useState } from 'react';

type Props = {
  id?: string;
  children: React.ReactNode;
  minHeight?: number;
  className?: string;
};

/** Defer heavy section trees until near viewport — improves mobile TTI. */
export function LazyMountSection({
  id,
  children,
  minHeight = 160,
  className,
}: Props): React.ReactElement {
  const ref = useRef<HTMLElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || mounted) return;

    if (typeof IntersectionObserver === 'undefined') {
      setMounted(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        setMounted(true);
        observer.disconnect();
      },
      { rootMargin: '240px 0px', threshold: 0.01 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [mounted]);

  return (
    <section
      id={id}
      ref={ref}
      className={className}
      data-lazy-mounted={mounted ? 'true' : 'false'}
    >
      {mounted ? (
        children
      ) : (
        <div
          className="gv-mobile-section-skeleton rh-cc-skeleton"
          style={{ minHeight }}
          aria-hidden
        />
      )}
    </section>
  );
}
