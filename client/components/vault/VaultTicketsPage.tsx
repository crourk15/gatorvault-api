'use client';

import React from 'react';
import { TICKET_GAMES } from '@/lib/vault-catalog';
import { SCHEDULE_GAMES } from '@/lib/schedule-data';

const TYPE_CLASS: Record<string, string> = {
  HOME: 'gv-ticket-type--home',
  AWAY: 'gv-ticket-type--away',
  NEUTRAL: 'gv-ticket-type--neutral',
};

function gameTypeFromLabel(label: string): 'HOME' | 'AWAY' | 'NEUTRAL' {
  if (label.includes('@')) return 'AWAY';
  if (label.toLowerCase().includes('jacksonville')) return 'NEUTRAL';
  return 'HOME';
}

export function VaultTicketsPage(): React.ReactElement {
  return (
    <div className="gv-vault-tickets" data-testid="vault-tickets">
      <div className="gv-page-hero">
        <h1 className="gv-page-title">Schedule & Tickets</h1>
        <p className="gv-page-subtitle">
          Full 2026 schedule with TV info and ticket links for every Gators game.
        </p>
      </div>

      <section className="gv-schedule-section">
        <h2 className="gv-vault-alerts__section-title">2026 Schedule</h2>
        <ul className="gv-schedule-list">
          {SCHEDULE_GAMES.map((g) => {
            const type = gameTypeFromLabel(g.label);
            return (
              <li key={g.id} className="gv-schedule-row">
                <div className="gv-schedule-row__logo" aria-hidden="true">
                  🐊
                </div>
                <div className="gv-schedule-row__body">
                  <h3 className="gv-schedule-row__matchup">{g.label}</h3>
                  <p className="gv-schedule-row__opp">{g.opp}</p>
                  <p className="gv-schedule-row__meta">
                    {g.date} · {g.venue}
                  </p>
                  {g.tv && g.tv !== 'FLEX' && g.tv !== 'EARLY' && g.tv !== 'NIGHT' ? (
                    <p className="gv-schedule-row__tv">📺 {g.tv}</p>
                  ) : (
                    <p className="gv-schedule-row__tv">📺 {g.tv || 'TBD'}</p>
                  )}
                </div>
                <span className={`gv-ticket-type ${TYPE_CLASS[type] ?? ''}`}>{type}</span>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="gv-schedule-section">
        <h2 className="gv-vault-alerts__section-title">Get Tickets</h2>
        <div className="gv-vault-tickets__list">
          {TICKET_GAMES.map((tg) => (
            <article key={tg.game + tg.date} className="gv-ticket-card">
              <div className="gv-ticket-card__header">
                <div>
                  <h3 className="gv-ticket-card__game">{tg.game}</h3>
                  <p className="gv-ticket-card__date">{tg.date}</p>
                  <p className="gv-ticket-card__venue">{tg.venue}</p>
                </div>
                <span className={`gv-ticket-type ${TYPE_CLASS[tg.type] ?? ''}`}>{tg.type}</span>
              </div>
              {tg.note ? <p className="gv-ticket-card__note">📺 {tg.note}</p> : null}
              <div className="gv-ticket-card__actions">
                <a
                  href="https://floridagators.com/tickets"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="gv-ticket-btn gv-ticket-btn--primary"
                >
                  Official UF Tickets
                </a>
                <a
                  href="https://stubhub.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="gv-ticket-btn gv-ticket-btn--outline"
                >
                  StubHub
                </a>
                <a
                  href="https://seatgeek.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="gv-ticket-btn gv-ticket-btn--outline"
                >
                  SeatGeek
                </a>
              </div>
            </article>
          ))}
        </div>
      </section>

      <div className="gv-vault-tickets__tips">
        <div className="gv-vault-tip">
          <p className="gv-vault-tip__label">Pro Tip</p>
          <p className="gv-vault-tip__text">
            The Florida-Georgia game in Jacksonville sells out fast. Buy early and check SeatGeek for
            best resale prices.
          </p>
        </div>
        <div className="gv-vault-tip">
          <p className="gv-vault-tip__label">Season Ticket Holders</p>
          <p className="gv-vault-tip__text">
            Manage your tickets and parking at{' '}
            <a href="https://floridagators.com/tickets" target="_blank" rel="noopener noreferrer">
              floridagators.com/tickets
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
