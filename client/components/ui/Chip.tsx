'use client';

import React from 'react';

export type ChipVariant = 'default' | 'accent' | 'success' | 'danger' | 'warning' | 'muted';

type Props = {
  children: React.ReactNode;
  variant?: ChipVariant;
  className?: string;
};

export function portalStatusToChipVariant(status?: string | null): ChipVariant {
  const s = (status || '').toLowerCase();
  if (s.includes('commit') || s.includes('signed')) return 'success';
  if (s.includes('portal') || s.includes('transfer')) return 'warning';
  if (s.includes('decommit') || s.includes('flip')) return 'danger';
  if (s.includes('target') || s.includes('watch')) return 'accent';
  return 'default';
}

export function Chip({ children, variant = 'default', className = '' }: Props): React.ReactElement {
  const mapped = variant === 'warning' ? 'accent' : variant === 'muted' ? 'default' : variant;
  return (
    <span className={`gv-ds-chip gv-ds-chip--${mapped}${className ? ` ${className}` : ''}`}>
      {children}
    </span>
  );
}
