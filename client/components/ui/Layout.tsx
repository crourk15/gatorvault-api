'use client';

import React from 'react';

type SectionProps = {
  children: React.ReactNode;
  className?: string;
  hero?: boolean;
  id?: string;
  'aria-label'?: string;
  'data-testid'?: string;
};

export function Container({
  children,
  className = '',
  wide,
}: {
  children: React.ReactNode;
  className?: string;
  wide?: boolean;
}): React.ReactElement {
  return (
    <div className={`gv-container${wide ? ' gv-container--wide' : ''}${className ? ` ${className}` : ''}`}>
      {children}
    </div>
  );
}

export function Section({
  children,
  className = '',
  hero,
  id,
  'aria-label': ariaLabel,
  'data-testid': testId,
}: SectionProps): React.ReactElement {
  return (
    <section
      id={id}
      aria-label={ariaLabel}
      data-testid={testId}
      className={`gv-section${hero ? ' gv-section--hero' : ''}${className ? ` ${className}` : ''}`}
    >
      {children}
    </section>
  );
}

export function Grid2({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}): React.ReactElement {
  return <div className={`gv-grid-2${className ? ` ${className}` : ''}`}>{children}</div>;
}

export function Grid3({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}): React.ReactElement {
  return <div className={`gv-grid-3${className ? ` ${className}` : ''}`}>{children}</div>;
}
