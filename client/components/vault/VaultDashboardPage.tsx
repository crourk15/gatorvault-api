'use client';

import React, { useEffect, useState } from 'react';
import { fetchFutureCastHome } from '@/lib/futurecast-home-api';
import { fetchRecruitingBoard } from '@/lib/recruiting-board-api';
import { fetchNilDashboard } from '@/lib/nil-api';
import { SCHEDULE_GAMES } from '@/lib/schedule-data';

const QUICK_LINKS = [
  {
    href: '/vault/recruiting',
    icon: '🎯',
    title: 'Recruiting Hub',
    desc: 'Commits, targets, portal, heat check, and scouting.',
  },
  {
    href: '/vault/futurecast',
    icon: '📈',
    title: 'FutureCast',
    desc: 'Master board, trending, movement intel, and staff notes.',
  },
  {
    href: '/vault/team',
    icon: '👥',
    title: 'Team',
    desc: 'Full roster, depth chart, and portal tags.',
  },
  {
    href: '/vault/live-feed',
    icon: '⚡',
    title: 'Live Feed',
    desc: 'Headlines, beat writers, podcasts, and ticker.',
  },
  {
    href: '/vault/schedule',
    icon: '🎟️',
    title: 'Schedule & Tickets',
    desc: 'Full 2026 schedule with TV info and ticket links.',
  },
  {
    href: '/vault/film-room',
    icon: '📺',
    title: 'Film Room',
    desc: 'Scheme breakdowns, clips, and press conferences.',
  },
  {
    href: '/vault/game-week',
    icon: '🏈',
    title: 'Game Week',
    desc: 'Matchups, win probability, and film notes.',
  },
  {
    href: '/vault/live-scores',
    icon: '📊',
    title: 'Live Scores',
    desc: 'Schedule, live scores, and season stat placeholders.',
  },
  {
    href: '/vault/articles',
    icon: '📰',
    title: 'Insider Articles',
    desc: 'Film breakdowns, coaching intel, and roster analysis.',
  },
  {
    href: '/vault/community',
    icon: '💬',
    title: 'Community',
    desc: 'Member threads, live rooms, and community pulse.',
  },
  {
    href: '/vault/game-zone',
    icon: '🏆',
    title: 'Game Zone',
    desc: 'Score predictor, polls, trivia, and Vault points.',
  },
  {
    href: '/vault/nil',
    icon: '💰',
    title: 'NIL Tracker',
    desc: 'SEC rankings, UF KPIs, and recent NIL events.',
  },
  {
    href: '/vault/futurecast/movement',
    icon: '📡',
    title: 'Movement Intel',
    desc: 'Full movement dashboard — risers, fallers, volatility.',
  },
  {
    href: '/vault/alerts',
    icon: '🔔',
    title: 'My Alerts',
    desc: 'Notification preferences and your personalized feed.',
  },
  {
    href: '/vault/apparel',
    icon: '👕',
    title: 'Apparel',
    desc: 'Official shops and gameday gear storefronts.',
  },
];

interface DashboardPulse {
  commits: number;
  targets: number;
  trending: number;
  nilSecRank: number | null;
  nextGame: string;
  nextGamePct: number;
}

export function VaultDashboardPage(): React.ReactElement {
  const nextGame = SCHEDULE_GAMES[0];
  const [pulse, setPulse] = useState<DashboardPulse>({
    commits: 0,
    targets: 0,
    trending: 0,
    nilSecRank: null,
    nextGame: nextGame?.label ?? 'Season opener',
    nextGamePct: nextGame?.ufPct ?? 0,
  });

  useEffect(() => {
    let cancelled = false;
    async function loadPulse() {
      try {
        const [board, fc, nil] = await Promise.all([
          fetchRecruitingBoard(2027).catch(() => null),
          fetchFutureCastHome().catch(() => null),
          fetchNilDashboard().catch(() => null),
        ]);
        if (cancelled) return;
        setPulse({
          commits: board?.commits?.length ?? fc?.commits?.length ?? 0,
          targets: board?.targets?.length ?? fc?.topTargets?.length ?? 0,
          trending: (fc?.trendingUp?.length ?? 0) + (fc?.trendingDown?.length ?? 0),
          nilSecRank: nil?.ufStanding?.secRank ?? null,
          nextGame: nextGame?.label ?? 'Season opener',
          nextGamePct: nextGame?.ufPct ?? 0,
        });
      } catch {
        /* keep defaults */
      }
    }
    void loadPulse();
    return () => {
      cancelled = true;
    };
  }, [nextGame?.label, nextGame?.ufPct]);

  return (
    <div className="gv-vault-dashboard" data-testid="vault-dashboard">
      <div className="gv-page-hero">
        <h1 className="gv-page-title">Welcome to GatorVault 🐊</h1>
        <p className="gv-page-subtitle">
          Recruiting Hub, FutureCast, Team, Live Feed, and Schedule — your five core pillars.
        </p>
      </div>

      <section className="gv-vault-dashboard__pulse" aria-label="Live pillar pulse">
        <a href="/vault/recruiting" className="gv-vault-dashboard__pulse-card">
          <span className="gv-vault-dashboard__pulse-value">{pulse.commits}</span>
          <span className="gv-vault-dashboard__pulse-label">2027 Commits</span>
        </a>
        <a href="/vault/futurecast" className="gv-vault-dashboard__pulse-card">
          <span className="gv-vault-dashboard__pulse-value">{pulse.trending}</span>
          <span className="gv-vault-dashboard__pulse-label">Trending Moves</span>
        </a>
        <a href="/vault/recruiting?tab=targets-2027" className="gv-vault-dashboard__pulse-card">
          <span className="gv-vault-dashboard__pulse-value">{pulse.targets}</span>
          <span className="gv-vault-dashboard__pulse-label">Top Targets</span>
        </a>
        <a href="/vault/nil" className="gv-vault-dashboard__pulse-card">
          <span className="gv-vault-dashboard__pulse-value">
            {pulse.nilSecRank != null ? `#${pulse.nilSecRank}` : '—'}
          </span>
          <span className="gv-vault-dashboard__pulse-label">NIL SEC Rank</span>
        </a>
        <a href="/vault/game-week" className="gv-vault-dashboard__pulse-card">
          <span className="gv-vault-dashboard__pulse-value">{pulse.nextGamePct}%</span>
          <span className="gv-vault-dashboard__pulse-label">{pulse.nextGame}</span>
        </a>
      </section>

      <div className="gv-vault-dashboard__grid">
        {QUICK_LINKS.map((item) => (
          <a key={item.href} href={item.href} className="gv-vault-dashboard__card">
            <span className="gv-vault-dashboard__icon" aria-hidden="true">
              {item.icon}
            </span>
            <h2 className="gv-vault-dashboard__card-title">{item.title}</h2>
            <p className="gv-vault-dashboard__card-desc">{item.desc}</p>
          </a>
        ))}
      </div>

      <section className="gv-vault-dashboard__welcome">
        <h2 className="gv-vault-dashboard__welcome-title">Welcome Email</h2>
        <p className="gv-vault-dashboard__welcome-text">
          You&apos;ll receive one welcome email with your access link, tier benefits, and next steps.
        </p>
      </section>
    </div>
  );
}
