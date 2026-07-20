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

export function NavIconFutureCast({ className }: IconProps): React.ReactElement {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M4 19V5M4 19h16" strokeLinecap="round" />
      <path d="M7 15l3-4 3 2 4-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function NavIconSchedule({ className }: IconProps): React.ReactElement {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M8 3v4M16 3v4M3 11h18" strokeLinecap="round" />
    </svg>
  );
}

export function NavIconFilm({ className }: IconProps): React.ReactElement {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M10 9l5 3-5 3V9Z" strokeLinejoin="round" />
    </svg>
  );
}

export function NavIconGameWeek({ className }: IconProps): React.ReactElement {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function NavIconScores({ className }: IconProps): React.ReactElement {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M4 18V8M10 18V4M16 18v-6M22 18V10" strokeLinecap="round" />
    </svg>
  );
}

export function NavIconArticles({ className }: IconProps): React.ReactElement {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M5 4h14v16H5V4Z" strokeLinejoin="round" />
      <path d="M8 8h8M8 12h8M8 16h5" strokeLinecap="round" />
    </svg>
  );
}

export function NavIconCommunity({ className }: IconProps): React.ReactElement {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M8 18v-1a3 3 0 0 1 3-3h2a3 3 0 0 1 3 3v1" strokeLinecap="round" />
      <circle cx="12" cy="8" r="3" />
      <path d="M4 18v-1a2.5 2.5 0 0 1 2-2.45M20 18v-1a2.5 2.5 0 0 0-2-2.45M6 7.2A2.5 2.5 0 0 1 8 5M18 7.2A2.5 2.5 0 0 0 16 5" strokeLinecap="round" />
    </svg>
  );
}

export function NavIconGameZone({ className }: IconProps): React.ReactElement {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <rect x="3" y="7" width="18" height="11" rx="3" />
      <path d="M8 12h2M9 11v2M15 11v.01M17 13v.01" strokeLinecap="round" />
    </svg>
  );
}

export function NavIconNil({ className }: IconProps): React.ReactElement {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v10M9.5 9.5c0-1.1 1.1-2 2.5-2s2.5.9 2.5 2-1.1 2-2.5 2-2.5.9-2.5 2 1.1 2 2.5 2 2.5-.9 2.5-2" strokeLinecap="round" />
    </svg>
  );
}

export function NavIconPodcasts({ className }: IconProps): React.ReactElement {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M12 3a4 4 0 0 0-4 4v5a4 4 0 0 0 8 0V7a4 4 0 0 0-4-4Z" />
      <path d="M5 12a7 7 0 0 0 14 0M12 19v2" strokeLinecap="round" />
    </svg>
  );
}

export function NavIconAlerts({ className }: IconProps): React.ReactElement {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M6 9a6 6 0 1 1 12 0c0 4 1.5 5.5 1.5 5.5H4.5S6 13 6 9Z" strokeLinejoin="round" />
      <path d="M10 19a2 2 0 0 0 4 0" strokeLinecap="round" />
    </svg>
  );
}

export function NavIconApparel({ className }: IconProps): React.ReactElement {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M9 4 7 7 3 8l2 3v8h14v-8l2-3-4-1-2-3-3 1-3-1Z" strokeLinejoin="round" />
    </svg>
  );
}

export function NavIconAccount({ className }: IconProps): React.ReactElement {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20a7 7 0 0 1 14 0" strokeLinecap="round" />
    </svg>
  );
}

export function NavIconVault({ className }: IconProps): React.ReactElement {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M4 10h16v10H4V10Z" strokeLinejoin="round" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" strokeLinecap="round" />
      <circle cx="12" cy="15" r="1.5" />
    </svg>
  );
}

export type PremiumNavIconId =
  | 'home'
  | 'recruiting'
  | 'team'
  | 'live'
  | 'menu'
  | 'pulse'
  | 'futurecast'
  | 'schedule'
  | 'film'
  | 'gameweek'
  | 'scores'
  | 'articles'
  | 'community'
  | 'gamezone'
  | 'nil'
  | 'podcasts'
  | 'alerts'
  | 'apparel'
  | 'account'
  | 'vault';

const ICON_MAP: Record<PremiumNavIconId, React.ComponentType<IconProps>> = {
  home: NavIconHome,
  recruiting: NavIconRecruiting,
  team: NavIconTeam,
  live: NavIconLive,
  menu: NavIconMenu,
  pulse: NavIconPulse,
  futurecast: NavIconFutureCast,
  schedule: NavIconSchedule,
  film: NavIconFilm,
  gameweek: NavIconGameWeek,
  scores: NavIconScores,
  articles: NavIconArticles,
  community: NavIconCommunity,
  gamezone: NavIconGameZone,
  nil: NavIconNil,
  podcasts: NavIconPodcasts,
  alerts: NavIconAlerts,
  apparel: NavIconApparel,
  account: NavIconAccount,
  vault: NavIconVault,
};

export function isPremiumNavIconId(id: string): id is PremiumNavIconId {
  return Object.prototype.hasOwnProperty.call(ICON_MAP, id);
}

export function PremiumNavIcon({ id, className }: { id: PremiumNavIconId; className?: string }): React.ReactElement {
  const Icon = ICON_MAP[id];
  return <Icon className={className} />;
}
