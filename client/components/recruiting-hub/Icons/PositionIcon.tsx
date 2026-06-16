'use client';

import React from 'react';
import { normalizePosition, type PositionIconKey } from './iconMap';

type Props = {
  position?: string | null;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  label?: string;
};

function iconPath(key: PositionIconKey): React.ReactNode {
  switch (key) {
    case 'QB':
      return <path d="M12 4a8 8 0 1 0 8 8h-2a6 6 0 1 1-6-6V4z" />;
    case 'RB':
      return <path d="M8 20V8l4-4 4 4v12H8zm2-2h4v-8l-2-2-2 2v8z" />;
    case 'WR':
      return <path d="M6 20l10-16h4L10 20H6zm2-2h6.5L18 8h-1.5L8 18z" />;
    case 'TE':
      return <path d="M7 20V9l5-5 5 5v11H7zm2-2h6v-7l-3-3-3 3v7z" />;
    case 'OL':
      return <path d="M5 18h14v2H5v-2zm1-2 2-10h8l2 10H6z" />;
    case 'DL':
      return <path d="M6 18V8l6-4 6 4v10H6zm2-2h8v-6.5l-4-2.7-4 2.7V16z" />;
    case 'EDGE':
      return <path d="M5 18 12 4l7 14H5zm3.2-2h7.6L12 8.5 8.2 16z" />;
    case 'LB':
      return <path d="M8 18 12 6l4 12H8zm1.8-2h4.4L12 10.2 9.8 16z" />;
    case 'CB':
      return <path d="M6 18 12 5l6 13H6zm2.2-2h7.6L12 9.5 8.2 16z" />;
    case 'S':
      return <path d="M12 4 20 18H4L12 4zm0 4.2L7.4 16h9.2L12 8.2z" />;
    case 'K/P':
      return <path d="M12 4v8m0 0-4 4m4-4 4 4M6 20h12" stroke="currentColor" strokeWidth="2" fill="none" />;
    case 'ATH':
    default:
      return <path d="M12 3 4 21h16L12 3zm0 5.5L16.8 19h-9.6L12 8.5z" />;
  }
}

export function PositionIcon({ position, size = 'md', className = '', label }: Props): React.ReactElement {
  const key = normalizePosition(position);
  const sizeClass =
    size === 'lg' ? 'rh-pos-icon--lg' : size === 'sm' ? 'rh-pos-icon--sm' : 'rh-pos-icon--md';
  const text = label ?? key;

  return (
    <span className={`rh-pos-icon ${sizeClass}${className ? ` ${className}` : ''}`} aria-label={text} title={text}>
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        {iconPath(key)}
      </svg>
      <span className="rh-pos-icon__label">{text}</span>
    </span>
  );
}

/** @deprecated */
export const RecruitingPositionIcon = PositionIcon;

/** @deprecated */
export { normalizePosition as normalizeRecruitingPosition };
