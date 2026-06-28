'use client';

import React from 'react';
import { isFutureCastInsider } from '@/lib/futurecast-insider';

type Props = {
  message?: string;
  limit?: number;
  total?: number;
};

export function FutureCastInsiderCTA({
  message = 'Film Room unlocks full FutureCast — UF confidence, fit scores, movement intel, and staff notes.',
  limit,
  total,
}: Props): React.ReactElement | null {
  if (isFutureCastInsider()) return null;

  const prefix =
    total != null && limit != null && total > limit ? `Showing ${limit} of ${total} · ` : '';

  return (
    <div className="gv-paywall-gate" data-testid="fc-insider-cta">
      <img src="/icons/lock.svg" alt="" className="gv-paywall-lock-icon" />
      <p className="gv-paywall-text">
        {prefix}
        {message}
      </p>
      <a href="/join?tier=film" className="gv-paywall-cta">
        Unlock FutureCast Insider
      </a>
    </div>
  );
}
