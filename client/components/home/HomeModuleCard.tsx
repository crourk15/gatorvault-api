'use client';

import React from 'react';

export type HomeModuleStat = {
  value: string;
  label: string;
  tone?: 'accent' | 'up' | 'down' | 'neutral';
};

type Props = {
  gridClass?: string;
  eyebrow: string;
  title: string;
  subtitle?: string;
  stats?: HomeModuleStat[];
  link?: { href: string; label: string };
  testId?: string;
  ariaLabel: string;
  loading?: boolean;
  skeletonHeight?: number;
  children?: React.ReactNode;
  className?: string;
};

export function HomeModuleCard({
  gridClass = 'gv-home__cell--12',
  eyebrow,
  title,
  subtitle,
  stats,
  link,
  testId,
  ariaLabel,
  loading,
  skeletonHeight = 180,
  children,
  className = '',
}: Props): React.ReactElement {
  const statsClass =
    stats && stats.length === 2
      ? 'gv-home-card__stats gv-home-card__stats--two'
      : stats && stats.length >= 3
        ? 'gv-home-card__stats gv-home-card__stats--three'
        : 'gv-home-card__stats';

  if (loading) {
    return (
      <article className={`gv-home__cell ${gridClass}`.trim()} aria-label={ariaLabel} data-testid={testId}>
        <div className="gv-home-skeleton gv-home-skeleton--card" style={{ minHeight: skeletonHeight }} />
      </article>
    );
  }

  return (
    <article className={`gv-home__cell ${gridClass}`.trim()} aria-label={ariaLabel} data-testid={testId}>
      <div className={`gv-home-card ${className}`.trim()}>
        <div className="gv-home-card__accent" />
        <p className="gv-home-card__eyebrow">{eyebrow}</p>
        <h2 className="gv-home-card__title">{title}</h2>
        {subtitle ? <p className="gv-home-card__meta">{subtitle}</p> : null}

        {stats && stats.length > 0 ? (
          <div className={statsClass}>
            {stats.map((stat) => (
              <div key={stat.label} className="stat">
                <span>{stat.label}</span>
                <strong>{stat.value}</strong>
              </div>
            ))}
          </div>
        ) : null}

        {children}

        {link ? (
          <a href={link.href} className="gv-home-link">
            {link.label}
          </a>
        ) : null}
      </div>
    </article>
  );
}
