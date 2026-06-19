'use client';

import React from 'react';

type Metric = {
  label: string;
  value: string | number;
  highlight?: boolean;
};

type Props = {
  eyebrow?: string;
  title: string;
  sub?: string;
  badge?: string;
  metrics?: Metric[];
  testId?: string;
};

/** Compact premium hero for standalone FutureCast sub-pages (RH / Lab parity). */
export function FutureCastSubPageHero({
  eyebrow = 'FutureCast Command Center',
  title,
  sub,
  badge,
  metrics,
  testId = 'fc-subpage-hero',
}: Props): React.ReactElement {
  return (
    <section className="fc-lab-hero fc-lab-bleed fc-premium-sub-hero" data-testid={testId}>
      <div className="fc-lab-hero__bg" aria-hidden />
      <div className="fc-lab-hero__inner rh-frame">
        <div className="fc-lab-hero__col fc-lab-hero__col--overview">
          <p className="fc-lab-hero__eyebrow rh-cc-hero__eyebrow">{eyebrow}</p>
          <h1 className="fc-lab-hero__title rh-cc-hero__title">{title}</h1>
          {sub ? <p className="fc-lab-hero__sub rh-cc-hero__sub">{sub}</p> : null}
          {metrics && metrics.length > 0 ? (
            <div className="fc-lab-hero__metrics rh-cc-hero__metrics">
              {metrics.map((m) => (
                <div
                  key={m.label}
                  className={`fc-lab-hero__metric rh-cc-hero__metric${m.highlight ? ' fc-lab-hero__metric--rank rh-cc-hero__metric--rank' : ''}`}
                >
                  <span className="fc-lab-hero__metric-label rh-cc-hero__metric-label">{m.label}</span>
                  <strong className="fc-lab-hero__metric-value rh-cc-hero__metric-value">{m.value}</strong>
                </div>
              ))}
            </div>
          ) : null}
          {badge ? <p className="fc-lab-hero__updated">{badge}</p> : null}
        </div>
      </div>
    </section>
  );
}
