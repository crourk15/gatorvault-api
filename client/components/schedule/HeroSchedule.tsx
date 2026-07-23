'use client';

import React from 'react';
import { GatorVaultWordmark } from '@/components/brand/GatorVaultWordmark';
import { Button } from '@/components/ui';

type Props = {
  season: string;
  subtitle: string;
  primaryCta?: { label: string; href: string };
  secondaryCta?: { label: string; href: string };
  /** When true, CTAs live on the next-up stage instead of the hero copy. */
  hideCtas?: boolean;
  children?: React.ReactNode;
};

export function HeroSchedule({
  season,
  subtitle,
  primaryCta,
  secondaryCta,
  hideCtas = false,
  children,
}: Props): React.ReactElement {
  return (
    <section className="gv-sched-hero" data-testid="schedule-hero">
      <div className="gv-sched-hero__stage" aria-hidden="true" />
      <div className="gv-sched-hero__inner">
        <div className="gv-sched-hero__copy">
          <GatorVaultWordmark height={28} className="gv-sched-hero__wordmark" />
          <p className="gv-sched-hero__eyebrow">{season} Season</p>
          <h1 className="gv-sched-hero__title">Schedule</h1>
          <p className="gv-sched-hero__sub">{subtitle}</p>
          {!hideCtas && (primaryCta || secondaryCta) ? (
            <div className="gv-sched-hero__cta">
              {primaryCta ? (
                <Button href={primaryCta.href} variant="primary" target="_blank" rel="noopener noreferrer">
                  {primaryCta.label}
                </Button>
              ) : null}
              {secondaryCta ? (
                <Button href={secondaryCta.href} variant="secondary" target="_blank" rel="noopener noreferrer">
                  {secondaryCta.label}
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>
        {children}
      </div>
      <div className="gv-sched-hero__accent" aria-hidden="true" />
    </section>
  );
}
