'use client';

import React from 'react';
import type { RecruitingSnapshot } from '@/lib/vault-dashboard-api';
import { GV_COPY } from '@/lib/gatorvault-copy';
import { SITE_ROUTES } from '@/lib/site-routes';

const CARDS: {
  key: keyof RecruitingSnapshot;
  label: string;
  icon: string;
  href: string;
  format: (v: RecruitingSnapshot) => string;
}[] = [
  {
    key: 'commits',
    label: '2027 Commits',
    icon: '🎯',
    href: `${SITE_ROUTES.recruiting}?tab=commits-2027`,
    format: (s) => String(s.commits),
  },
  {
    key: 'targets',
    label: 'Top Targets',
    icon: '⭐',
    href: `${SITE_ROUTES.recruiting}?tab=targets-2027`,
    format: (s) => String(s.targets),
  },
  {
    key: 'portalActive',
    label: 'Portal Active',
    icon: '🔄',
    href: `${SITE_ROUTES.recruiting}/portal`,
    format: (s) => String(s.portalActive),
  },
  {
    key: 'classRank',
    label: 'Class Rank',
    icon: '🏆',
    href: `${SITE_ROUTES.recruiting}/board`,
    format: (s) => (s.classRank != null ? `#${s.classRank}` : '—'),
  },
  {
    key: 'nilSecRank',
    label: 'NIL Rank (SEC)',
    icon: '💰',
    href: SITE_ROUTES.nil,
    format: (s) => (s.nilSecRank != null ? `#${s.nilSecRank}` : '—'),
  },
  {
    key: 'winProbability',
    label: 'Win Prob vs FAU',
    icon: '🏈',
    href: SITE_ROUTES.gameWeek,
    format: (s) => `${s.winProbability}%`,
  },
];

export function DashboardRecruitingSnapshot({
  snapshot,
  loading,
}: {
  snapshot: RecruitingSnapshot | null;
  loading?: boolean;
}): React.ReactElement {
  if (loading || !snapshot) {
    return (
      <section className="gv-dash-recruit gv-dash__section" aria-label="Recruiting snapshot">
        <div className="gv-dash__frame">
          <h2 className="gv-dash__section-heading gv-type-h2">{GV_COPY.headlines.recruitingSnapshot}</h2>
          <div className="gv-dash-recruit__grid">
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="gv-dash-skeleton gv-dash-skeleton--card" />
            ))}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="gv-dash-recruit gv-dash__section" aria-label="Recruiting snapshot" data-testid="dashboard-recruiting">
      <div className="gv-dash__frame">
        <div className="gv-dash-recruit__head">
          <h2 className="gv-dash__section-heading gv-type-h2">{GV_COPY.headlines.recruitingSnapshot}</h2>
          <a href={`${SITE_ROUTES.recruiting}?tab=priority`} className="gv-btn gv-btn--primary gv-dash-recruit__cta">
            High Priority Intel →
          </a>
        </div>
        <div className="gv-dash-recruit__grid">
        {CARDS.map((card) => (
          <a key={card.key} href={card.href} className="gv-dash-recruit__card">
            <span className="gv-dash-recruit__icon" aria-hidden="true">
              {card.icon}
            </span>
            <span className="gv-dash-recruit__value">{card.format(snapshot)}</span>
            <span className="gv-dash-recruit__label">{card.label}</span>
          </a>
        ))}
        </div>
      </div>
    </section>
  );
}
