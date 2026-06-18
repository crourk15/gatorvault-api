'use client';

import React from 'react';
import { timeAgo } from '@/components/home/home-utils';

type Props = {
  updatedAt?: string | null;
};

export function HomeHeader({ updatedAt }: Props): React.ReactElement {
  const label = updatedAt ? timeAgo(updatedAt) || 'Just now' : 'Just now';

  return (
    <header className="gv-hcc-header" data-testid="home-command-header">
      <div className="gv-hcc-header__watermark" aria-hidden />
      <p className="gv-hcc-header__eyebrow">GatorVault Insider</p>
      <p className="gv-hcc-header__live">
        <span className="gv-hcc-header__dot" aria-hidden />
        Live · Updated {label}
      </p>
    </header>
  );
}
