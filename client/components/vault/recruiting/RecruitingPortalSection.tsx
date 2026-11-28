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
import { RecruitingPanelHeader } from '@/components/recruiting-hub/RecruitingPanelHeader';

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
      <RecruitingPanelHeader
        kicker={prep.window.label}
        title="Portal War Room"
        dek={`${prep.thesis.addCount}. ${prep.thesis.not} ${prep.namesLandWhen}`}
        stats={[
          {
            label: windowOpen ? 'Window' : 'Opens in',
            value: windowOpen ? 'Open' : `${opensIn} day${opensIn === 1 ? '' : 's'}`,
          },
          { label: 'Hunt', value: prep.thesis.addCount.replace(/ difference makers$/i, '') || '10–12' },
          {
            label: 'Must add',
            value: prep.mustAdd.length ? prep.mustAdd.join(' · ') : '—',
          },
          {
            label: 'Incoming',
            value: incoming.length ? String(incoming.length) : 'Empty',
          },
        ]}
      />

      {prep.thesis.line ? <p className="gv-rh-portal-prep__thesis">{prep.thesis.line}</p> : null}

      {incoming.length > 0 ? (
        <div className="gv-rh-portal-prep__incoming" data-testid="portal-incoming">
          <h3 className="gv-rh-portal-prep__section-title">Incoming</h3>
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
        </div>
      ) : (
        <p
          className="gv-rh-portal-prep__empty gv-rh-portal-prep__empty--inline"
          data-testid="portal-incoming-empty"
        >
          {loading ? 'Loading verified names…' : 'Incoming empty until a name is verified. The hunt is the rooms.'}
        </p>
      )}

      <div className="gv-rh-portal-prep__board">
        <h3 className="gv-rh-portal-prep__section-title">Position rooms</h3>
        <ol className="gv-rh-portal-prep__rooms" data-testid="portal-rooms">
          {prep.rooms.map((room) => (
            <li key={room.room} className={`gv-rh-portal-room gv-rh-portal-room--${room.tier}`}>
              <span className="gv-rh-portal-room__rank">#{room.rank}</span>
              <div className="gv-rh-portal-room__main">
                <div className="gv-rh-portal-room__head">
                  <h3 className="gv-rh-portal-room__pos">{room.room}</h3>
                  <span className="gv-rh-portal-room__tier">{room.tierLabel}</span>
                </div>
                <p className="gv-rh-portal-room__hunt">{room.hunt || room.dek}</p>
                {room.dek && room.hunt && room.hunt !== room.dek ? (
                  <p className="gv-rh-portal-room__dek">{room.dek}</p>
                ) : null}
                {room.alreadySigned.length > 0 ? (
                  <ul className="gv-rh-portal-room__signed">
                    {room.alreadySigned.map((name) => (
                      <li key={name}>{name}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/** @deprecated use PortalList */
export const RecruitingPortalSection = PortalList;
