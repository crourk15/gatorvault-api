'use client';

import React from 'react';

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
    desc: 'Big board, movement intel, staff notes, and trending.',
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
    href: '/vault/tickets',
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
    href: '/vault/futurecast/staff',
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

export function VaultDashboardPage(): React.ReactElement {
  return (
    <div className="gv-vault-dashboard" data-testid="vault-dashboard">
      <div className="gv-page-hero">
        <h1 className="gv-page-title">Welcome to GatorVault 🐊</h1>
        <p className="gv-page-subtitle">
          Recruiting Hub, FutureCast, Team, Live Feed, and Schedule — your five core pillars.
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
