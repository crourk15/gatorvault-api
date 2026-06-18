'use client';

import React, { useEffect, useRef } from 'react';
import { useHomeMetrics } from '@/hooks/home/useHomeMetrics';
import { HomeMiniSparkline } from '@/components/home/command-center/widgets/HomeMiniSparkline';

export function HomeMetricsSlider(): React.ReactElement {
  const metrics = useHomeMetrics();
  const scrollRef = useRef<HTMLDivElement>(null);

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
          const inner = (
            <>
              <div className="gv-metric-card__label">{m.label}</div>
              <div className="gv-metric-card__value">{m.value}</div>
              <div className="gv-metric-card__sparkline">
                <HomeMiniSparkline values={m.sparkline ?? []} tone={m.tone} />
              </div>
            </>
          );
          return m.href ? (
            <a key={m.id} href={m.href} className="gv-metric-card">
              {inner}
            </a>
          ) : (
            <div key={m.id} className="gv-metric-card">
              {inner}
            </div>
          );
        })}
      </div>
    </div>
  );
}
