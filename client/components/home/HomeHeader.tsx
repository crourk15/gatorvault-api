'use client';

import React from 'react';
import { fetchLiveTicker } from '@/lib/vault-home-api';
import { timeAgo } from '@/components/home/home-utils';
import { useEffect, useState } from 'react';

export function HomeHeader(): React.ReactElement {
  const [updatedLabel, setUpdatedLabel] = useState('just now');

  useEffect(() => {
    void fetchLiveTicker()
      .then((ticker) => {
        setUpdatedLabel(timeAgo(ticker.updatedAt) || 'just now');
      })
      .catch(() => {
        /* keep default */
      });
  }, []);

  return (
    <header className="gv-home-header" data-testid="home-command-header">
      <div className="gv-home-header__title">GATORVAULT INSIDER</div>
      <div className="gv-home-header__status">
        <span className="gv-dot gv-dot--live" aria-hidden /> Live • Updated {updatedLabel}
      </div>
    </header>
  );
}
