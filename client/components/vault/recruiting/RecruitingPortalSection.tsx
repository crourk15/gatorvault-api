'use client';

import React, { useEffect, useState } from 'react';
import { fetchPortalIncoming, type PortalIncomingPlayer } from '@/lib/recruiting-api';
import { PlayerCardEnhanced } from '@/components/vault/recruiting/EliteRecruitCard';
import { schoolLogoInitials } from '@/lib/recruiting-hub-utils';
import { playerProfilePath } from '@/lib/player-routes';

const PORTAL_SEASON_OPEN = false;

export function PortalList(): React.ReactElement {
  const [players, setPlayers] = useState<PortalIncomingPlayer[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!PORTAL_SEASON_OPEN) return;
    setLoading(true);
    void fetchPortalIncoming(24)
      .then(setPlayers)
      .catch(() => setPlayers([]))
      .finally(() => setLoading(false));
  }, []);

  if (!PORTAL_SEASON_OPEN) {
    return (
      <div className="gv-rh-portal-closed" data-testid="portal-closed">
        <span className="gv-rh-portal-closed__icon" aria-hidden="true">
          🔒
        </span>
        <h2 className="gv-rh-section-title">Portal Closed</h2>
        <p className="gv-rh-section-sub">
          No active portal entries. When the transfer portal opens, enhanced player cards will show
          transfer badges, previous school logos, eligibility remaining, fit scores, and movement
          arrows.
        </p>
      </div>
    );
  }

  if (loading) {
    return <p className="gv-rh-status">Loading portal targets…</p>;
  }

  if (players.length === 0) {
    return <p className="gv-rh-section-sub">No portal targets loaded.</p>;
  }

  return (
    <div className="gv-rh-portal-grid" data-testid="portal-grid">
      {players.map((p) => (
        <article key={p.id} className="gv-rh-portal-card">
          <span className="gv-rh-portal-card__badge">Transfer Portal</span>
          <PlayerCardEnhanced
            forceElite
            variant="target"
            player={{
              slug: p.slug,
              name: p.fullName,
              position: p.position,
              classYear: p.classYear,
              fitScore: p.ufFitScore ?? undefined,
              lifecycle: 'PORTAL',
              movementDirection: 'up',
              school: p.previousSchool ?? undefined,
              predictionSchools: p.previousSchool
                ? [{ school: p.previousSchool, pct: 0 }]
                : undefined,
            }}
          />
          {p.previousSchool && (
            <div className="gv-rh-portal-card__school">
              <span className="gv-rh-portal-card__school-logo" aria-hidden="true">
                {schoolLogoInitials(p.previousSchool)}
              </span>
              <span>Previous: {p.previousSchool}</span>
            </div>
          )}
          <a
            href={playerProfilePath(p.slug, 'PORTAL', true, p.fullName, 'recruiting')}
            className="gv-rh-portal-card__link"
          >
            View profile →
          </a>
        </article>
      ))}
    </div>
  );
}

/** @deprecated use PortalList */
export const RecruitingPortalSection = PortalList;
