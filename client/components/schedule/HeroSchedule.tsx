'use client';

import React from 'react';
import { Button } from '@/components/ui';

type Props = {
  title: string;
  subtitle: string;
  primaryCta?: { label: string; href: string };
  secondaryCta?: { label: string; href: string };
};

export function HeroSchedule({ title, subtitle, primaryCta, secondaryCta }: Props): React.ReactElement {
  return (
    <section className="gv-sched-hero rh-hero" data-testid="schedule-hero">
      <div className="rh-hero__bg gv-sched-hero__bg" aria-hidden="true" />
      <div className="gv-sched-hero__inner rh-container">
        <h1 className="gv-sched-hero__title rh-hero__title">{title}</h1>
        <p className="gv-sched-hero__sub rh-hero__subtitle">{subtitle}</p>
        {(primaryCta || secondaryCta) && (
          <div className="gv-sched-hero__cta">
            {primaryCta ? (
              <Button href={primaryCta.href} variant="primary" target="_blank" rel="noopener noreferrer">
                {primaryCta.label}
              </Button>
            ) : null}
            {secondaryCta ? (
              <Button href={secondaryCta.href} variant="secondary">
                {secondaryCta.label}
              </Button>
            ) : null}
          </div>
        )}
      </div>
    </section>
  );
}
