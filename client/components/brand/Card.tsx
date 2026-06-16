'use client';

import React from 'react';

type Variant = 'default' | 'light' | 'dark' | 'accent' | 'stat';

type Props = {
  variant?: Variant;
  interactive?: boolean;
  children: React.ReactNode;
  className?: string;
  href?: string;
  onClick?: () => void;
  'data-testid'?: string;
};

function cardClass(variant: Variant, interactive: boolean, className?: string): string {
  const parts: string[] = [];
  if (variant === 'stat') {
    parts.push('gv-stat-card');
  } else if (variant === 'accent') {
    parts.push('gv-card', 'gv-card--light');
  } else if (variant === 'dark') {
    parts.push('gv-card', 'gv-card--dark');
  } else if (variant === 'light' || variant === 'default') {
    parts.push('gv-card', 'gv-card--light');
  }
  if (interactive) parts.push('gv-card--interactive');
  if (className) parts.push(className);
  return parts.join(' ');
}

export function Card({
  variant = 'default',
  interactive = false,
  children,
  className,
  href,
  onClick,
  'data-testid': testId,
}: Props): React.ReactElement {
  const cls = cardClass(variant, interactive, className);

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
    <div className={cls} data-testid={testId}>
      {children}
    </div>
  );
}
