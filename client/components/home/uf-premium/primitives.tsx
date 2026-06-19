'use client';

import React from 'react';
import Link from 'next/link';
import { VAULT_PILLAR_ROUTES } from '@/lib/vault-route-map';

export function HeroSection(): React.ReactElement {
  return (
    <section className="uf-premium-hero" aria-label="UF Premium home hero" data-testid="uf-premium-hero">
      <div className="uf-premium-hero__inner">
        <div className="uf-premium-hero__accent" aria-hidden="true" />
        <h1 className="uf-premium-hero__title">Only Gators Get Out Alive.</h1>
        <p className="uf-premium-hero__sub">UF football. Recruiting. FutureCast. All here.</p>
        <div className="uf-premium-hero__ctas">
          <Link href={VAULT_PILLAR_ROUTES.recruiting} className="uf-premium-cta uf-premium-cta--primary">
            Recruiting Hub
          </Link>
          <Link href={VAULT_PILLAR_ROUTES.futurecast} className="uf-premium-cta uf-premium-cta--secondary">
            FutureCast
          </Link>
          <Link href={VAULT_PILLAR_ROUTES.team} className="uf-premium-cta uf-premium-cta--secondary">
            Team Page
          </Link>
        </div>
      </div>
    </section>
  );
}

type SectionProps = {
  title: string;
  ctaLabel: string;
  ctaHref: string;
  children: React.ReactNode;
  testId: string;
};

export function UfPremiumSection({
  title,
  ctaLabel,
  ctaHref,
  children,
  testId,
}: SectionProps): React.ReactElement {
  return (
    <section className="uf-premium-section" data-testid={testId}>
      <div className="uf-premium-section__head">
        <h2 className="uf-premium-section__title">{title}</h2>
        <div className="uf-premium-section__underline" aria-hidden="true" />
      </div>
      {children}
      <div className="uf-premium-section__cta">
        <Link href={ctaHref} className="uf-premium-cta">
          {ctaLabel}
        </Link>
      </div>
    </section>
  );
}

type CardProps = {
  title: string;
  children: React.ReactNode;
};

export function UfPremiumCard({ title, children }: CardProps): React.ReactElement {
  return (
    <article className="uf-premium-card">
      <h3 className="uf-premium-card__title">{title}</h3>
      <div className="uf-premium-card__body">{children}</div>
    </article>
  );
}

export function UfPremiumMetric({ label, value }: { label: string; value: string }): React.ReactElement {
  return (
    <div className="uf-premium-metric">
      <span className="uf-premium-metric__label">{label}</span>
      <strong className="uf-premium-metric__value">{value}</strong>
    </div>
  );
}
