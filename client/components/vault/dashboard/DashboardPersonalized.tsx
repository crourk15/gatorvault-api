'use client';

import React, { useState } from 'react';
import type { PersonalizedResponse } from '@/lib/vault-dashboard-api';
import { GV_COPY } from '@/lib/gatorvault-copy';

function PersonalPanel({
  title,
  children,
  defaultOpen = true,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}): React.ReactElement {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className={`gv-dash-personal__panel${open ? ' is-open' : ''}`}>
      <button
        type="button"
        className="gv-dash-personal__toggle"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span>{title}</span>
        <span className="gv-dash-personal__chev" aria-hidden="true">
          {open ? '▾' : '▸'}
        </span>
      </button>
      <div className="gv-dash-personal__body">{children}</div>
    </div>
  );
}

export function DashboardPersonalized({
  data,
  loading,
}: {
  data: PersonalizedResponse | null;
  loading?: boolean;
}): React.ReactElement {
  if (loading || !data) {
    return (
      <section className="gv-dash-personal gv-dash__section" aria-label="Personalized for you">
        <div className="gv-dash__frame">
          <h2 className="gv-dash__section-heading gv-type-h2">{GV_COPY.headlines.yourFeed}</h2>
          <div className="gv-dash-personal__grid">
            {[1, 2, 3, 4].map((n) => (
              <div key={n} className="gv-dash-skeleton gv-dash-skeleton--card" />
            ))}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section
      className="gv-dash-personal gv-dash__section"
      aria-label="Personalized for you"
      data-testid="dashboard-personalized"
    >
      <div className="gv-dash__frame">
        <h2 className="gv-dash__section-heading gv-type-h2">{GV_COPY.headlines.yourFeed}</h2>

        <div className="gv-dash-personal__grid">
          <PersonalPanel title="Your Alerts">
            <ul className="gv-dash-personal__list">
              {data.alerts.slice(0, 4).map((alert) => (
                <li key={alert.id}>
                  {alert.url ? <a href={alert.url}>{alert.title}</a> : alert.title}
                  {alert.isNew && (
                    <span className="gv-badge gv-badge--new gv-dash-personal__new">New</span>
                  )}
                </li>
              ))}
              {data.alerts.length === 0 && <li>{GV_COPY.empty.noAlerts}</li>}
            </ul>
          </PersonalPanel>

          <PersonalPanel title="Your Saved Players">
            <ul className="gv-dash-personal__list">
              {data.savedPlayers.slice(0, 5).map((p) => (
                <li key={p.name}>{p.name}</li>
              ))}
              {data.savedPlayers.length === 0 && (
                <li>
                  <a href="/vault/alerts">{GV_COPY.empty.noSavedPlayers}</a>
                </li>
              )}
            </ul>
          </PersonalPanel>

          <PersonalPanel title="Your Watchlist">
            <ul className="gv-dash-personal__list">
              {data.watchlist.map((w) => (
                <li key={w.label}>
                  {w.href ? <a href={w.href}>{w.label}</a> : w.label}
                  {w.count != null ? ` (${w.count})` : ''}
                </li>
              ))}
              {data.watchlist.length === 0 && <li>{GV_COPY.empty.noWatchlist}</li>}
            </ul>
          </PersonalPanel>

          <PersonalPanel title="Your Favorite Threads">
            <ul className="gv-dash-personal__list">
              {data.favoriteThreads.slice(0, 4).map((t) => (
                <li key={t.id}>
                  <a href={t.href}>{t.title}</a>
                </li>
              ))}
              {data.favoriteThreads.length === 0 && (
                <li>
                  <a href="/vault/community">{GV_COPY.microcopy.joinConversation}</a>
                </li>
              )}
            </ul>
          </PersonalPanel>
        </div>
      </div>
    </section>
  );
}
