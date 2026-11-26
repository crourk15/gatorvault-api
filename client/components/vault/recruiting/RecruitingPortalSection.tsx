'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { fetchRecruitingPortalPayload } from '@/lib/recruiting-api';
import type { RecruitingBoardPlayer } from '@/lib/recruiting-board-api';
import { PlayerCardEnhanced } from '@/components/vault/recruiting/EliteRecruitCard';
import { schoolLogoInitials } from '@/lib/recruiting-hub-utils';
import { playerProfilePath } from '@/lib/player-routes';
import {
  PORTAL_PREP_SEED,
  daysUntilPortalOpen,
  type FanPortalPrep,
} from '@/lib/portal-prep';

function incomingName(p: RecruitingBoardPlayer): string {
  return String(p.name || '').trim() || 'Portal target';
}

export function PortalList(): React.ReactElement {
  const [prep, setPrep] = useState<FanPortalPrep>(PORTAL_PREP_SEED);
  const [incoming, setIncoming] = useState<RecruitingBoardPlayer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void fetchRecruitingPortalPayload()
      .then((data) => {
        if (cancelled) return;
        if (data.prep && Array.isArray(data.prep.rooms) && data.prep.rooms.length > 0) {
          setPrep(data.prep);
        }
        setIncoming(Array.isArray(data.incoming) ? data.incoming : []);
      })
      .catch(() => {
        if (cancelled) return;
        setIncoming([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const daysLeft = useMemo(
    () => daysUntilPortalOpen(prep.window.opens),
    [prep.window.opens]
  );
  const windowOpen = prep.season?.active === true;
  const opensIn = daysLeft;

  return (
    <section className="gv-rh-portal-prep" data-testid="portal-prep">
      <header className="gv-rh-portal-prep__hero">
        <p className="gv-rh-portal-prep__eyebrow">{prep.season?.label || 'Portal Prep'}</p>
        <h2 className="gv-rh-portal-prep__title">Football portal opens January 4, 2027</h2>
        <p className="gv-rh-portal-prep__sub">
          {prep.namesLandWhen} This is the room Florida will shop — {prep.thesis.addCount}.{' '}
          {prep.thesis.not}
        </p>
        <div className="gv-rh-portal-prep__stats">
          <div className="gv-rh-portal-prep__stat">
            <span className="gv-rh-portal-prep__stat-label">Window</span>
            <strong className="gv-rh-portal-prep__stat-value">{prep.window.label}</strong>
          </div>
          <div className="gv-rh-portal-prep__stat">
            <span className="gv-rh-portal-prep__stat-label">Hunt</span>
            <strong className="gv-rh-portal-prep__stat-value">10–12</strong>
          </div>
          <div className="gv-rh-portal-prep__stat">
            <span className="gv-rh-portal-prep__stat-label">Must add</span>
            <strong className="gv-rh-portal-prep__stat-value">
              {prep.mustAdd.length ? prep.mustAdd.join(' · ') : '—'}
            </strong>
          </div>
          <div className="gv-rh-portal-prep__stat">
            <span className="gv-rh-portal-prep__stat-label">
              {windowOpen ? 'Window' : 'Opens in'}
            </span>
            <strong className="gv-rh-portal-prep__stat-value">
              {windowOpen ? 'Open' : `${opensIn} day${opensIn === 1 ? '' : 's'}`}
            </strong>
          </div>
        </div>
      </header>

      <p className="gv-rh-portal-prep__thesis">{prep.thesis.line}</p>

      <div className="gv-rh-portal-prep__incoming" data-testid="portal-incoming">
        <h3 className="gv-rh-portal-prep__section-title">Incoming board</h3>
        {loading && incoming.length === 0 ? (
          <p className="gv-rh-portal-prep__empty">Loading verified names…</p>
        ) : incoming.length === 0 ? (
          <p className="gv-rh-portal-prep__empty" data-testid="portal-incoming-empty">
            Empty until a name is verified. The hunt is the rooms below.
          </p>
        ) : (
          <div className="gv-rh-portal-grid" data-testid="portal-grid">
            {incoming.map((p) => (
              <article key={p.slug} className="gv-rh-portal-card gv-rh-portal-card--in">
                <span className="gv-rh-portal-card__badge gv-rh-portal-card__badge--in">IN</span>
                <PlayerCardEnhanced
                  forceElite
                  variant="target"
                  player={{
                    slug: p.slug,
                    name: incomingName(p),
                    position: p.position || p.pos || undefined,
                    classYear: p.classYear,
                    fitScore: p.fitScore ?? undefined,
                    lifecycle: 'PORTAL',
                    movementDirection: 'up',
                    school: p.fromSchool || p.school || undefined,
                    predictionSchools:
                      p.fromSchool || p.school
                        ? [{ school: String(p.fromSchool || p.school), pct: 0 }]
                        : undefined,
                  }}
                />
                {(p.fromSchool || p.school) && (
                  <div className="gv-rh-portal-card__school">
                    <span className="gv-rh-portal-card__school-logo" aria-hidden="true">
                      {schoolLogoInitials(String(p.fromSchool || p.school))}
                    </span>
                    <span>Previous: {p.fromSchool || p.school}</span>
                  </div>
                )}
                <a
                  href={playerProfilePath(p.slug, 'PORTAL', true, incomingName(p), 'recruiting')}
                  className="gv-rh-portal-card__link"
                >
                  View profile →
                </a>
              </article>
            ))}
          </div>
        )}
      </div>

      <ol className="gv-rh-portal-prep__rooms" data-testid="portal-rooms">
        {prep.rooms.map((room) => (
          <li
            key={room.room}
            className={`gv-rh-portal-room gv-rh-portal-room--${room.tier}`}
          >
            <div className="gv-rh-portal-room__head">
              <span className="gv-rh-portal-room__rank">#{room.rank}</span>
              <h3 className="gv-rh-portal-room__pos">{room.room}</h3>
              <span className="gv-rh-portal-room__tier">{room.tierLabel}</span>
            </div>
            <p className="gv-rh-portal-room__dek">{room.dek}</p>
            {room.hunt && room.hunt !== room.dek ? (
              <p className="gv-rh-portal-room__hunt">Hunt: {room.hunt}</p>
            ) : null}
            {room.alreadySigned.length > 0 ? (
              <p className="gv-rh-portal-room__signed">
                Already signed: {room.alreadySigned.join(', ')}
              </p>
            ) : null}
          </li>
        ))}
      </ol>
    </section>
  );
}

/** @deprecated use PortalList */
export const RecruitingPortalSection = PortalList;
