'use client';

import React from 'react';

export type PageTheme = 'blue' | 'navy' | 'white' | 'stadium' | 'chalkboard';

type Props = {
  theme?: PageTheme;
  title?: string;
  subtitle?: string;
  hero?: React.ReactNode;
  accent?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  'data-testid'?: string;
  testId?: string;
};

export function PageLayout({
  theme = 'navy',
  title,
  subtitle,
  hero,
  accent,
  children,
  className = '',
  'data-testid': dataTestId,
  testId,
}: Props): React.ReactElement {
  const resolvedTestId = testId ?? dataTestId;
  return (
    <div
      className={`gv-page-layout gv-page-layout--${theme}${className ? ` ${className}` : ''}`}
      data-testid={resolvedTestId}
    >
      {hero ?? (title ? (
        <header className="gv-page-layout__hero">
          <div className="gv-page-layout__hero-inner">
            <div className="gv-page-layout__hero-text">
              <h1 className="gv-page-layout__title gv-type-h1">{title}</h1>
              {subtitle ? <p className="gv-page-layout__subtitle gv-type-body">{subtitle}</p> : null}
            </div>
            {accent ? <div className="gv-page-layout__accent">{accent}</div> : null}
          </div>
        </header>
      ) : null)}
      <div className="gv-page-layout__body">{children}</div>
    </div>
  );
}

type SectionProps = {
  title?: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  id?: string;
  'data-testid'?: string;
};

export function PageSection({
  title,
  subtitle,
  action,
  children,
  className = '',
  id,
  'data-testid': testId,
}: SectionProps): React.ReactElement {
  return (
    <section id={id} className={`gv-page-section${className ? ` ${className}` : ''}`} data-testid={testId}>
      {(title || action) && (
        <div className="gv-page-section__head">
          <div>
            {title ? <h2 className="gv-page-section__title gv-type-h2">{title}</h2> : null}
            {subtitle ? <p className="gv-page-section__subtitle gv-type-body">{subtitle}</p> : null}
          </div>
          {action ? <div className="gv-page-section__action">{action}</div> : null}
        </div>
      )}
      {children}
    </section>
  );
}

type GridProps = {
  cols?: 2 | 3;
  children: React.ReactNode;
  className?: string;
};

export function GridLayout({ cols = 3, children, className = '' }: GridProps): React.ReactElement {
  return (
    <div className={`gv-page-grid gv-page-grid--${cols}${className ? ` ${className}` : ''}`}>
      {children}
    </div>
  );
}
