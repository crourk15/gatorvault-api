'use client';

import React from 'react';
import { TICKET_GAMES } from '@/lib/vault-catalog';

const TYPE_CLASS: Record<string, string> = {
  HOME: 'gv-ticket-type--home',
  AWAY: 'gv-ticket-type--away',
  NEUTRAL: 'gv-ticket-type--neutral',
};

export function VaultTicketsPage(): React.ReactElement {
  return (
    <div className="gv-vault-tickets" data-testid="vault-tickets">
      <div className="gv-page-hero">
        <h1 className="gv-page-title">🎟️ Find Your Seats — 2026 Gators Football</h1>
        <p className="gv-page-subtitle">
          Get the best prices on UF home games, road trips, and The World&apos;s Largest Outdoor
          Cocktail Party.
        </p>
      </div>

      <div className="gv-vault-tickets__list">
        {TICKET_GAMES.map((tg) => (
          <article key={tg.game + tg.date} className="gv-ticket-card">
            <div className="gv-ticket-card__header">
              <div>
                <h2 className="gv-ticket-card__game">{tg.game}</h2>
                <p className="gv-ticket-card__date">{tg.date}</p>
                <p className="gv-ticket-card__venue">{tg.venue}</p>
              </div>
              <span className={`gv-ticket-type ${TYPE_CLASS[tg.type] ?? ''}`}>{tg.type}</span>
            </div>
            {tg.note ? <p className="gv-ticket-card__note">⚠️ {tg.note}</p> : null}
            <div className="gv-ticket-card__actions">
              <a
                href="https://floridagators.com/tickets"
                target="_blank"
                rel="noopener noreferrer"
                className="gv-ticket-btn gv-ticket-btn--primary"
              >
                🏟️ Official UF Tickets
              </a>
              <a
                href="https://stubhub.com"
                target="_blank"
                rel="noopener noreferrer"
                className="gv-ticket-btn gv-ticket-btn--outline"
              >
                🎟️ StubHub
              </a>
              <a
                href="https://seatgeek.com"
                target="_blank"
                rel="noopener noreferrer"
                className="gv-ticket-btn gv-ticket-btn--outline"
              >
                💰 SeatGeek
              </a>
            </div>
          </article>
        ))}
      </div>

      <div className="gv-vault-tickets__tips">
        <div className="gv-vault-tip">
          <p className="gv-vault-tip__label">💡 Pro Tip</p>
          <p className="gv-vault-tip__text">
            The Florida-Georgia game in Jacksonville sells out fast. Buy early and check SeatGeek for
            best resale prices.
          </p>
        </div>
        <div className="gv-vault-tip">
          <p className="gv-vault-tip__label">🎟️ Season Ticket Holders</p>
          <p className="gv-vault-tip__text">
            Manage your tickets and parking at{' '}
            <a
              href="https://floridagators.com/tickets"
              target="_blank"
              rel="noopener noreferrer"
            >
              floridagators.com/tickets
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
