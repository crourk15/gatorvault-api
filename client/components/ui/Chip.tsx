'use client';

import React from 'react';

export type ChipVariant = 'in' | 'out' | 'target' | 'timestamp';

type Props = {
  variant: ChipVariant;
  children: React.ReactNode;
  className?: string;
};

export function Chip({ variant, children, className = '' }: Props): React.ReactElement {
  return (
    <span className={`gv-chip gv-chip--${variant}${className ? ` ${className}` : ''}`}>
      {children}
    </span>
  );
}

/** Map portal / transfer status strings to chip variant */
export function portalStatusToChipVariant(status?: string | null): ChipVariant {
  const s = String(status ?? '')
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, '_');
  if (/IN|INCOMING|ENTERED|PORTAL_IN/.test(s)) return 'in';
  if (/OUT|OUTGOING|EXIT|PORTAL_OUT|TRANSFERRED/.test(s)) return 'out';
  return 'target';
}
