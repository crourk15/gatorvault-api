'use client';

import React from 'react';

type LegacyVariant = 'blue' | 'orange' | 'staff' | 'neutral' | 'success' | 'trending';
type PortalVariant = 'in' | 'out' | 'target' | 'timestamp';
type Variant = LegacyVariant | PortalVariant;

type Props = {
  variant?: Variant;
  children: React.ReactNode;
  className?: string;
};

function variantClass(variant: Variant): string {
  switch (variant) {
    case 'in':
      return 'gv-chip gv-chip--in';
    case 'out':
      return 'gv-chip gv-chip--out';
    case 'target':
      return 'gv-chip gv-chip--target';
    case 'timestamp':
      return 'gv-chip gv-chip--timestamp';
    case 'blue':
      return 'gv-chip gv-chip--blue';
    case 'orange':
      return 'gv-chip gv-chip--orange';
    case 'staff':
      return 'gv-chip gv-chip--staff';
    case 'success':
      return 'gv-badge gv-badge--commit';
    case 'trending':
      return 'gv-badge gv-badge--trending';
    default:
      return 'gv-chip gv-chip--neutral';
  }
}

export function Chip({ variant = 'neutral', children, className = '' }: Props): React.ReactElement {
  return (
    <span className={`${variantClass(variant)}${className ? ` ${className}` : ''}`}>{children}</span>
  );
}

export { portalStatusToChipVariant } from '@/components/ui/Chip';
