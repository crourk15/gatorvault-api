'use client';

import React from 'react';
import Link from 'next/link';

type Props = {
  children: React.ReactNode;
  className?: string;
  href?: string;
  hover?: boolean;
  'data-testid'?: string;
};

export function Card({ children, className = '', href, hover = false, 'data-testid': testId }: Props): React.ReactElement {
  const cls = `gv-ds-card${hover ? ' gv-ds-card--hover' : ''}${className ? ` ${className}` : ''}`;

  if (href) {
    return (
      <Link href={href} className={cls} data-testid={testId}>
        {children}
      </Link>
    );
  }

  return (
    <div className={cls} data-testid={testId}>
      {children}
    </div>
  );
}
