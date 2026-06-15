'use client';

import React from 'react';
import { isFutureCastInsider } from '@/lib/futurecast-insider';
import { FutureCastInsiderCTA } from './FutureCastInsiderCTA';

type Props = {
  children: React.ReactNode;
  teaser?: React.ReactNode;
  limit?: number;
  total?: number;
  className?: string;
  hideGate?: boolean;
  variant?: 'gate' | 'overlay';
};

export function InsiderPaywall({
  children,
  teaser,
  limit,
  total,
  className = '',
  hideGate = false,
  variant = 'gate',
}: Props): React.ReactElement {
  const insider = isFutureCastInsider();

  if (insider) {
    return <div className={className}>{children}</div>;
  }

  if (variant === 'overlay') {
    return (
      <div className={`gv-paywall-locked gv-insider-paywall ${className}`.trim()}>
        <div className="gv-insider-blur" aria-hidden="true">
          {children}
        </div>
        <div className="gv-paywall-overlay">
          <img src="/icons/lock.svg" alt="" className="gv-paywall-lock-icon" />
          <p className="gv-paywall-text">
            FutureCast Insider unlocks full confidence, movement intel, and staff notes.
          </p>
          <a href="/join" className="gv-paywall-cta">
            Unlock FutureCast Insider
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className={`gv-insider-paywall ${className}`.trim()}>
      {teaser ?? children}
      {!hideGate ? <FutureCastInsiderCTA limit={limit} total={total} /> : null}
    </div>
  );
}

export function BlurredValue({
  value,
  placeholder = '—',
}: {
  value: React.ReactNode;
  placeholder?: string;
}): React.ReactElement {
  if (isFutureCastInsider()) return <>{value}</>;
  return <span className="gv-insider-blur">{placeholder}</span>;
}
