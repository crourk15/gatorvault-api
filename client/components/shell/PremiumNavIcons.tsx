'use client';

import React from 'react';

type IconProps = { className?: string };

export function NavIconHome({ className }: IconProps): React.ReactElement {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1v-9.5Z" strokeLinejoin="round" />
    </svg>
  );
}

export function NavIconRecruiting({ className }: IconProps): React.ReactElement {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="3" />
      <path d="M12 4v2M12 18v2M4 12h2M18 12h2" strokeLinecap="round" />
    </svg>
  );
}

export function NavIconTeam({ className }: IconProps): React.ReactElement {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M16 19v-1a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v1" strokeLinecap="round" />
      <circle cx="10" cy="8" r="3" />
      <path d="M20 19v-1a3 3 0 0 0-2-2.83M16 4.17A3 3 0 0 1 18 7" strokeLinecap="round" />
    </svg>
  );
}

export function NavIconLive({ className }: IconProps): React.ReactElement {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M13 2 3 14h7l-1 8 10-12h-7l1-8Z" strokeLinejoin="round" />
    </svg>
  );
}

export function NavIconMenu({ className }: IconProps): React.ReactElement {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
    </svg>
  );
}

export function NavIconPulse({ className }: IconProps): React.ReactElement {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M3 12h3l2-7 4 14 2-7h5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export type PremiumNavIconId = 'home' | 'recruiting' | 'team' | 'live' | 'menu' | 'pulse';

const ICON_MAP: Record<PremiumNavIconId, React.ComponentType<IconProps>> = {
  home: NavIconHome,
  recruiting: NavIconRecruiting,
  team: NavIconTeam,
  live: NavIconLive,
  menu: NavIconMenu,
  pulse: NavIconPulse,
};

export function PremiumNavIcon({ id, className }: { id: PremiumNavIconId; className?: string }): React.ReactElement {
  const Icon = ICON_MAP[id];
  return <Icon className={className} />;
}
