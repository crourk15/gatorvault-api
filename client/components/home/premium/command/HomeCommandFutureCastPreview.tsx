'use client';

import React, { useEffect, useState } from 'react';
import type { HomeFutureCastTargetView } from '@/components/home/premium/command/home-command-utils';
import { VAULT_PILLAR_ROUTES } from '@/lib/vault-route-map';

type Props = {
  targets: HomeFutureCastTargetView[];
  loading?: boolean;
};

function ProgressRing({ pct }: { pct: number }): React.ReactElement {
  const radius = 22;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (pct / 100) * circumference;

  return (
    <div className="home-wow-fc-ring-wrap">
      <svg className="home-wow-fc-ring" viewBox="0 0 52 52" aria-hidden="true">
        <circle className="home-wow-fc-ring-bg" cx="26" cy="26" r={radius} />
        <circle
          className="home-wow-fc-ring-fill"
          cx="26"
          cy="26"
          r={radius}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <span className="home-wow-fc-ring-label">{pct}%</span>
    </div>
  );
}

function movementLabel(movement: HomeFutureCastTargetView['movement']): string {
  if (movement === 'up') return '↑';
  if (movement === 'down') return '↓';
  return '→';
}

function TargetSlide({ target }: { target: HomeFutureCastTargetView }): React.ReactElement {
  return (
    <div className="home-wow-fc-slide" key={target.id}>
      <div className="home-wow-fc-silhouette" aria-hidden="true">
        {target.position}
      </div>
      <ProgressRing pct={target.ufPctNum} />
      <div className="home-wow-fc-body">
        <p className="home-wow-fc-name">{target.name}</p>
        <div className="home-wow-fc-meta">
          <span className={`home-wow-fc-move home-wow-fc-move--${target.movement}`}>
            {movementLabel(target.movement)} Movement
          </span>
          <span className="home-wow-fc-tag">{target.tag}</span>
        </div>
      </div>
    </div>
  );
}

export function HomeCommandFutureCastPreview({ targets, loading }: Props): React.ReactElement {
  const [activeIndex, setActiveIndex] = useState(0);
  const slides = targets.slice(0, 6);

  useEffect(() => {
    if (slides.length <= 1) return undefined;
    const id = setInterval(() => {
      setActiveIndex((idx) => (idx + 1) % slides.length);
    }, 6000);
    return () => clearInterval(id);
  }, [slides.length]);

  const active = slides[activeIndex];

  return (
    <>
      <div className="home-wow-section-header">
        <h2 className="home-wow-section-title">FutureCast Preview</h2>
        <p className="home-wow-section-subtitle">Top UF leaners from the FutureCast model.</p>
      </div>
      <section className="home-wow-card" data-testid="home-futurecast-preview">
        {loading ? (
          <div className="home-wow-skeleton" aria-hidden="true" />
        ) : slides.length === 0 ? (
          <div className="home-wow-fc-empty">
            <p className="home-wow-empty">Top UF leaners from the FutureCast model.</p>
            <a href={VAULT_PILLAR_ROUTES.futurecast} className="home-wow-cta-link">
              Open FutureCast Lab →
            </a>
          </div>
        ) : (
          <>
            <div className="home-wow-fc-carousel">{active ? <TargetSlide target={active} /> : null}</div>
            {slides.length > 1 ? (
              <div className="home-wow-fc-dots" role="tablist" aria-label="FutureCast targets">
                {slides.map((slide, idx) => (
                  <button
                    key={slide.id}
                    type="button"
                    className={`home-wow-fc-dot${idx === activeIndex ? ' home-wow-fc-dot--active' : ''}`}
                    aria-label={`Show ${slide.name}`}
                    aria-selected={idx === activeIndex}
                    onClick={() => setActiveIndex(idx)}
                  />
                ))}
              </div>
            ) : null}
            <a href={VAULT_PILLAR_ROUTES.futurecast} className="home-wow-cta-link">
              Open FutureCast Lab →
            </a>
          </>
        )}
      </section>
    </>
  );
}
