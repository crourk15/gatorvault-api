'use client';

import React from 'react';

export type RecruitingHubCardVariant = 'default' | 'intel' | 'commit' | 'module' | 'tool';

type Props = {
  variant?: RecruitingHubCardVariant;
  className?: string;
  href?: string;
  children: React.ReactNode;
  onClick?: () => void;
  testId?: string;
};

export function RecruitingHubCard({
  variant = 'default',
  className = '',
  href,
  children,
  onClick,
  testId,
}: Props): React.ReactElement {
  const cls = `gv-rh-card gv-rh-card--${variant}${className ? ` ${className}` : ''}`;

  if (href) {
    return (
      <a href={href} className={cls} data-testid={testId}>
        {children}
      </a>
    );
  }

  if (onClick) {
    return (
      <button type="button" className={cls} onClick={onClick} data-testid={testId}>
        {children}
      </button>
    );
  }

  return (
    <article className={cls} data-testid={testId}>
      {children}
    </article>
  );
}
