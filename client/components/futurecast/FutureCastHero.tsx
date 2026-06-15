'use client';

import React, { useEffect, useRef } from 'react';

type Props = {
  title?: string;
  subtitle?: string;
  badge?: string;
};

const DEFAULT_TITLE = 'FutureCast — Florida Recruiting Intelligence';
const DEFAULT_SUBTITLE = 'Movement, confidence, predictors, and class impact';
const DEFAULT_BADGE = 'Updated daily';

export function FutureCastHero({
  title = DEFAULT_TITLE,
  subtitle = DEFAULT_SUBTITLE,
  badge = DEFAULT_BADGE,
}: Props): React.ReactElement {
  const heroRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const hero = heroRef.current;
    if (!hero) return;

    const onScroll = () => {
      const y = window.scrollY;
      const offset = Math.min(y * 0.08, 5);
      hero.style.setProperty('--gv-parallax', `${offset}px`);
    };

    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      ref={heroRef}
      className="gv-hero gv-fade-in"
      data-testid="fc-elite-hero"
      style={{ ['--gv-parallax' as string]: '0px' }}
    >
      <div className="gv-hero-content">
        <h1 className="gv-hero-title">{title}</h1>
        <p className="gv-hero-subtitle">{subtitle}</p>
        {badge ? <span className="gv-hero-badge">{badge}</span> : null}
        <div className="gv-hero-underline" aria-hidden="true" />
      </div>
    </header>
  );
}
