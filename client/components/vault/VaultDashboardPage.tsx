'use client';

import React from 'react';

const QUICK_LINKS = [
  {
    href: '/vault/depth-chart',
    icon: '🐊',
    title: 'Team Hub',
    desc: 'History, staff, roster, and depth chart.',
  },
  {
    href: '/vault/recruiting',
    icon: '🎯',
    title: 'Recruiting',
    desc: "Heat check, class boards, and FutureCast intel.",
  },
  {
    href: '/vault/futurecast',
    icon: '📈',
    title: 'FutureCast',
    desc: '2027 cycle predictions, stock board, and movement.',
  },
  {
    href: '/vault/scouting',
    icon: '🔭',
    title: 'War Room',
    desc: 'Scouting database and player breakdowns.',
  },
  {
    href: '/vault/portal',
    icon: '🔄',
    title: 'Portal Radar',
    desc: 'Incoming transfers and portal watchlist.',
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
    href: '/vault/live-feed',
    icon: '⚡',
    title: 'Live Feed',
    desc: 'Headlines, beat writers, and podcasts.',
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
    href: '/vault/recruiting-board',
    icon: '📊',
    title: 'Recruiting Board',
    desc: 'Full interactive recruiting board.',
  },
  {
    href: '/vault/futurecast/staff',
    icon: '⚙️',
    title: 'Staff Dashboard',
    desc: 'Movement heatmap and staff intel tools.',
  },
  {
    href: '/vault/alerts',
    icon: '🔔',
    title: 'My Alerts',
    desc: 'Notification preferences and your personalized feed.',
  },
  {
    href: '/vault/tickets',
    icon: '🎟️',
    title: 'Tickets',
    desc: '2026 schedule with official and resale links.',
  },
  {
    href: '/vault/apparel',
    icon: '👕',
    title: 'Apparel',
    desc: 'Official shops and gameday gear storefronts.',
  },
];

export function VaultDashboardPage(): React.ReactElement {
  return (
    <div className="gv-vault-dashboard" data-testid="vault-dashboard">
      <div className="gv-page-hero">
        <h1 className="gv-page-title">Welcome to GatorVault 🐊</h1>
        <p className="gv-page-subtitle">
          Your insider hub for depth charts, recruiting, portal intel, and film breakdowns.
        </p>
      </div>

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
