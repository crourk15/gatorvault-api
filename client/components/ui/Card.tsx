'use client';

import React from 'react';

type Variant = 'light' | 'dark';

type Props = {
  variant?: Variant;
  interactive?: boolean;
  className?: string;
  children: React.ReactNode;
} & React.HTMLAttributes<HTMLDivElement>;

function cardClass(variant: Variant, interactive: boolean, className?: string): string {
  const parts = ['gv-card', `gv-card--${variant}`];
  if (interactive) parts.push('gv-card--interactive');
  if (className) parts.push(className);
  return parts.join(' ');
}

export function Card({
  variant = 'dark',
  interactive = false,
  className,
  children,
  ...rest
}: Props): React.ReactElement {
  return (
    <div className={cardClass(variant, interactive, className)} {...rest}>
      {children}
    </div>
  );
}
