'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useHomeMetrics } from '@/hooks/home/useHomeMetrics';
import { HomeMiniSparkline } from '@/components/home/command-center/widgets/HomeMiniSparkline';

export function HomeMetricsSlider(): React.ReactElement {
  const metrics = useHomeMetrics();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    const root = scrollRef.current;
    if (!root || typeof IntersectionObserver === 'undefined') return;

    const cards = root.querySelectorAll('.gv-metric-card');
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('gv-metric-card--visible');
          }
        });
      },
      { root, threshold: 0.2, rootMargin: '0px 8px 0px 0px' }
    );

    cards.forEach((card) => observer.observe(card));
    return () => observer.disconnect();
  }, [metrics]);

  const handlePressStart = useCallback((id: string) => () => setActiveId(id), []);
  const handlePressEnd = useCallback(() => setActiveId(null), []);

  if (!metrics) {
    return (
      <div className="gv-metrics-slider">
        <div className="gv-metrics-slider__scroll">
          {[1, 2, 3].map((n) => (
            <div key={n} className="gv-home-skeleton-block" style={{ minWidth: 140, flex: '0 0 140px' }} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="gv-metrics-slider" data-testid="home-metrics-slider">
      <div ref={scrollRef} className="gv-metrics-slider__scroll no-scrollbar">
        {metrics.map((m) => {
          const cardClass = [
            'gv-metric-card',
            activeId === m.id ? 'gv-metric-card--active' : '',
          ]
            .filter(Boolean)
            .join(' ');

          const inner = (
            <>
              <div className="gv-metric-card__label">{m.label}</div>
              <div className="gv-metric-card__value">{m.value}</div>
              {m.meta ? <div className="gv-metric-card__meta">{m.meta}</div> : null}
              <div className="gv-metric-card__sparkline">
                <HomeMiniSparkline values={m.sparkline ?? []} tone={m.tone} />
              </div>
            </>
          );

          const pressProps = {
            onMouseDown: handlePressStart(m.id),
            onMouseUp: handlePressEnd,
            onMouseLeave: handlePressEnd,
            onTouchStart: handlePressStart(m.id),
            onTouchEnd: handlePressEnd,
          };

          return m.href ? (
            <a key={m.id} href={m.href} className={cardClass} {...pressProps}>
              {inner}
            </a>
          ) : (
            <div key={m.id} className={cardClass} {...pressProps}>
              {inner}
            </div>
          );
        })}
      </div>
    </div>
  );
}
