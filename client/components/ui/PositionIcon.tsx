'use client';

import React from 'react';
import {
  normalizePosition,
  type PositionIconKey,
} from '@/components/recruiting-hub/Icons/iconMap';

type Size = 'sm' | 'md' | 'lg';

type Props = {
  position?: string | null;
  size?: Size;
  variant?: 'on-blue' | 'on-white' | 'priority';
  className?: string;
  label?: string;
  showLabel?: boolean;
};

function sizeClass(size: Size): string {
  if (size === 'lg') return 'gv-pos-icon--lg';
  if (size === 'sm') return 'gv-pos-icon--sm';
  return 'gv-pos-icon--md';
}

/** Stroke-based 32×32 football position icons (2.5px stroke). */
function iconPaths(key: PositionIconKey): React.ReactNode {
  switch (key) {
    case 'QB':
      return (
        <>
          <ellipse cx="16" cy="11" rx="5" ry="6" />
          <path d="M11 17h10M13 17v5M19 17v5M11 22h10" />
        </>
      );
    case 'RB':
      return (
        <>
          <circle cx="16" cy="7" r="2.5" />
          <path d="M16 9.5v4M12 14l4-1 4 1M10 22l6-8.5 6 8.5" />
        </>
      );
    case 'WR':
      return (
        <>
          <circle cx="16" cy="7" r="2.5" />
          <path d="M16 9.5v3M13 22c2-6 4-9 3-12.5M19 22c-2-6-4-9-3-12.5" />
        </>
      );
    case 'TE':
      return (
        <>
          <circle cx="16" cy="7" r="2.5" />
          <path d="M16 9.5v4M12 14h8M13 14v8M19 14v8" />
        </>
      );
    case 'OL':
      return (
        <>
          <path d="M8 12h16v3H8zM10 15v7M14 15v7M18 15v7M22 15v7" />
          <path d="M8 22h16" />
        </>
      );
    case 'DL':
      return (
        <>
          <path d="M7 14h18v3H7zM9 17v5M13 17v5M19 17v5M23 17v5" />
          <path d="M7 22h18" />
        </>
      );
    case 'EDGE':
      return (
        <>
          <path d="M8 22 16 6l8 16H8z" />
          <path d="M12 16h8" />
        </>
      );
    case 'LB':
      return (
        <>
          <circle cx="16" cy="8" r="2.5" />
          <path d="M16 10.5v3M11 16l5-2.5 5 2.5M9 22l7-8.5 7 8.5" />
        </>
      );
    case 'CB':
      return (
        <>
          <circle cx="16" cy="8" r="2.5" />
          <path d="M10 22c1-7 3-10 6-12.5 3 2.5 5 5.5 6 12.5" />
          <path d="M12 18h8" />
        </>
      );
    case 'S':
      return (
        <>
          <path d="M16 6 24 20H8L16 6z" />
          <circle cx="16" cy="14" r="2" />
        </>
      );
    case 'K/P':
      return (
        <>
          <path d="M16 6v10" />
          <path d="M12 16h8M14 20h4" />
          <path d="M10 24h12" />
        </>
      );
    case 'ATH':
    default:
      return (
        <>
          <path d="M16 5 6 27h20L16 5z" />
          <path d="M11 20h10" />
        </>
      );
  }
}

export function PositionIcon({
  position,
  size = 'md',
  variant = 'on-blue',
  className = '',
  label,
  showLabel = true,
}: Props): React.ReactElement {
  const key = normalizePosition(position);
  const text = label ?? key;
  const variantClass =
    variant === 'on-white'
      ? 'gv-pos-icon--on-white'
      : variant === 'priority'
        ? 'gv-pos-icon--priority'
        : 'gv-pos-icon--on-blue';

  return (
    <span
      className={`gv-pos-icon rh-pos-icon ${sizeClass(size)} ${variantClass}${className ? ` ${className}` : ''}`}
      aria-label={text}
      title={text}
    >
      <svg viewBox="0 0 32 32" aria-hidden="true" focusable="false">
        {iconPaths(key)}
      </svg>
      {showLabel ? <span className="gv-pos-icon__label rh-pos-icon__label">{text}</span> : null}
    </span>
  );
}
